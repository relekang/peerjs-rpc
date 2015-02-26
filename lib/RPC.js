var sha1 = require("sha1");
var Promise = require("bluebird");
var Peer = require("peerjs");


function RPC(id, scope, options) {
    if ((typeof window !== "undefined" && this === window) || (typeof self !== "undefined" && this === self)) {
        throw new TypeError("Tried to call class RPC as a regular function. Classes can only be called with the 'new' keyword.");
    }
    var __scope_3__ = this;
    if (options) {
        var peerOptions = options.peerOptions || {};
        var peerConfig = options.peerConfig || {};
        this.debug = options.debug;
    }
    this.peer = new Peer(id, peerOptions, peerConfig);
    this.scope = scope;
    this.id = id;

    this.peer.on('connection', function(connection) {
        connection.on('data', function(data) {
            return __scope_3__._onData(connection, data);
        });
    });
}
RPC.prototype._callbacks = {};
RPC.prototype.invoke = function(id, func, args, callback) {
    var payload = {
        'type': 'rpc-invoke',
        'func': func,
        'args': args,
        'orig': this.id,
        'signature': this._createSignature()
    };
    return this._send(id, payload).nodeify(callback);
};
RPC.prototype.attr = function(id, attr, callback) {
    var payload = {
        'type': 'rpc-attr',
        'attr': attr,
        'orig': this.id,
        'signature': this._createSignature()
    };
    return this._send(id, payload).nodeify(callback);
};
RPC.prototype.ping = function(id, callback) {
    var payload = {
        'type': 'rpc-ping',
        'orig': this.id,
        'signature': this._createSignature()
    };
    return this._send(id, payload).nodeify(callback);
};
RPC.prototype._createSignature = function() {
    return sha1(Date.now());
};
RPC.prototype._onData = function(connection, data) {
    if (!'type' in data) {
        return;;
    }

    this._log('Received data: ' + JSON.stringify(data) + '');

    if (data.type.match(/^rpc-(:?ping|attr|invoke)$/)) {
        this._handlers[data.type].bind(this)(connection, data);
    } else {
        if (data.type.match(/return/)) {
            this._callbacks[data.signature](data.data);
        } else {
            if (data.type.match(/pong/)) {
                this._callbacks[data.signature](true);
            }
        }
    }
};
RPC.prototype._getConnection = function(id) {
    var __scope_18__ = this;
    return new Promise(function(resolve) {
        var connection = __scope_18__.peer.connect(id);
        if (connection) {
            connection.on('data', function(data) {
                return __scope_18__._onData(connection, data);
            });
            if (connection.open) {
                resolve(connection);
            } else {
                connection.on('open', function(conn) {
                    resolve(connection);
                });
            }
        }
    });
};
RPC.prototype._send = function(id, payload) {
    var __scope_21__ = this;
    return this._getConnection(id).then(function(connection) {
        return new Promise(function(resolve) {
            __scope_21__._callbacks[payload.signature] = resolve;
            connection.send(payload);
            __scope_21__._log('Sending payload ' + JSON.stringify(payload) + '');
        });
    });
};
RPC.prototype._log = function(message) {
    if (!this.debug) {
        return;
    }
    console.log('RPC:  ' + message + '');
};
RPC.prototype._handlers = {
    'rpc-ping': function(connection, data) {
        connection.send({
            'type': 'rpc-pong',
            'signature': data.signature,
            'orig': this.id
        });
    },
    'rpc-attr': function(connection, data) {
        connection.send({
            'type': 'rpc-attr-return',
            'data': this.scope[data.attr],
            'signature': data.signature,
            'orig': this.id
        });
    },
    'rpc-invoke': function(connection, data) {
        if (data.func in this.scope) {
            if (data.args === undefined) {
                data.args = []
            }
            if (!Array.isArray(data.args)) {
                data.args = [data.args]
            }
            data.args.push(function(err, result) {
                connection.send({
                    'type': 'rpc-return',
                    'data': result,
                    'signature': data.signature,
                    'orig': this.id
                });
            });
            this.scope[data.func].apply(this.scope, data.args);
        } else {
            connection.send({
                'type': 'rpc-return',
                'data': new Error('unknown function'),
                'signature': data.signature,
                'orig': this.id
            });
        }
    }
};


module.exports = RPC;