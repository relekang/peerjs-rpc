var sha1 = require("sha1");
var Promise = require("bluebird");
var Peer = require("peerjs");


function RPC(id, scope, peerOptions, peerConfig) {
    if ((typeof window !== "undefined" && this === window) || (typeof self !== "undefined" && this === self)) {
        throw new TypeError("Tried to call class RPC as a regular function. Classes can only be called with the 'new' keyword.");
    }
    var __scope_2__ = this;
    this.peer = new Peer(id, peerOptions, peerConfig);
    this.scope = scope;
    this.id = id;

    this.peer.on('connection', function(connection) {
        connection.on('data', function(data) {
            return __scope_2__._onData(connection, data);
        });
    });
}
RPC.prototype._callbacks = {};
RPC.prototype.invoke = function(id, func, args, callback) {
    var __scope_5__ = this;
    var signature = this._createSignature();
    return this._getConnection(id).then(function(connection) {
        return new Promise(function(resolve) {
            __scope_5__._callbacks[signature] = resolve;

            connection.send({
                'type': 'rpc-invoke',
                'func': func,
                'args': args,
                'orig': __scope_5__.id,
                'signature': signature
            });
        });
    }).nodeify(callback);
};
RPC.prototype.attr = function(id, attr, callback) {
    var __scope_8__ = this;
    var signature = this._createSignature();
    return this._getConnection(id).then(function(connection) {
        var __scope_7__ = this;
        return new Promise(function(resolve) {
            __scope_8__._callbacks[signature] = resolve;
            connection.send({
                'type': 'rpc-attr',
                'attr': attr,
                'orig': __scope_7__.id,
                'signature': signature
            });
        });
    }).nodeify(callback);
};
RPC.prototype.ping = function(id, callback) {
    var __scope_11__ = this;
    var signature = this._createSignature();
    return this._getConnection(id).then(function(connection) {
        return new Promise(function(resolve) {
            __scope_11__._callbacks[signature] = resolve;
            connection.send({
                'type': 'rpc-ping',
                'orig': __scope_11__.id,
                'signature': signature
            });
        });
    }).nodeify(callback);
};
RPC.prototype._createSignature = function() {
    return sha1(Date.now());
};
RPC.prototype._onData = function(connection, data) {
    if (!'type' in data) {
        return;;
    }

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
RPC.prototype._getConnection = function(id, callback) {
    var __scope_23__ = this;
    return new Promise(function(resolve) {
        var connection = __scope_23__.peer.connect(id);
        if (connection) {
            connection.on('data', function(data) {
                return __scope_23__._onData(connection, data);
            });
            if (connection.open) {
                resolve(connection);
            } else {
                connection.on('open', function(conn) {
                    resolve(connection);
                });
            }
        }
    }).nodeify(callback);
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