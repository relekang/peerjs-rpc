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
        this.timeout = options.timeout || 5000;
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
RPC.prototype._timeouts = {};
RPC.prototype.timeout = 5000;
RPC.prototype.invoke = function(id, func, args, callback) {
    var payload = {
        'type': 'rpc-invoke',
        'func': func,
        'args': args,
        'orig': this.id,
        'signature': this._createSignature(this.id, id, 'invoke')
    };
    return this._send(id, payload).nodeify(callback);
};
RPC.prototype.attr = function(id, attr, callback) {
    var payload = {
        'type': 'rpc-attr',
        'attr': attr,
        'orig': this.id,
        'signature': this._createSignature(this.id, id, 'attr')
    };
    return this._send(id, payload).nodeify(callback);
};
RPC.prototype.ping = function(id, callback) {
    var payload = {
        'type': 'rpc-ping',
        'orig': this.id,
        'signature': this._createSignature(this.id, id, 'ping')
    };
    return this._send(id, payload).catch(function(err) {
        if (err.message.match(/timed out/)) {
            return false;
        }
        throw err;
    }).nodeify(callback);
};
RPC.prototype._createSignature = function(from, to, func) {
    return sha1('' + Date.now() + ':' + from + ':' + to + ':' + func + '');
};
RPC.prototype._onData = function(connection, data) {
    if (!'type' in data) {
        return;;
    }

    this._log('Received data: ', data);

    if (data.type.match(/^rpc-(:?ping|attr|invoke)$/)) {
        this._handlers()[data.type].bind(this)(connection, data);
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
    var __scope_20__ = this;
    return new Promise(function(resolve) {
        var connection = __scope_20__.peer.connect(id);
        if (connection) {
            connection.on('data', function(data) {
                return __scope_20__._onData(connection, data);
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
    var __scope_27__ = this;
    return this._getConnection(id).then(function(connection) {
        return new Promise(function(resolve, reject) {
            __scope_27__._timeouts[payload.signature] = setTimeout(function() {
                reject(new Error('Message timed out.'));
            }, __scope_27__.timeout);
            __scope_27__._callbacks[payload.signature] = function(result) {
                clearTimeout(__scope_27__._timeouts[payload.signature]);
                if (result instanceof Error) {
                    reject(result);
                } else {
                    resolve(result);
                }
            };
            connection.send(payload);
            __scope_27__._log('Sending payload to "' + id + '": ', payload);
        });
    });
};
RPC.prototype._log = function(message, obj) {
    if (!this.debug) {
        return;
    }
    var CircularJSON = require('circular-json');
    console.log('RPC:  ' + message + ' ' + CircularJSON.stringify(obj) + '');
};
RPC.prototype._handlers = function() {
    var __scope_36__ = this;
    return {
        'rpc-ping': function(connection, data) {
            var payload = {
                'type': 'rpc-pong',
                'signature': data.signature,
                'orig': __scope_36__.id
            };
            __scope_36__._log('Sending payload: ', payload);
            connection.send(payload);
        },
        'rpc-attr': function(connection, data) {
            var payload = {
                'type': 'rpc-attr-return',
                'data': __scope_36__.scope[data.attr],
                'signature': data.signature,
                'orig': __scope_36__.id
            };
            __scope_36__._log('Sending payload: ', payload);
            connection.send(payload);
        },
        'rpc-invoke': function(connection, data) {
            var __scope_35__ = this;
            if (data.func in __scope_36__.scope) {
                if (data.args === undefined) {
                    data.args = []
                }
                if (!Array.isArray(data.args)) {
                    data.args = [data.args]
                }
                data.args.push(function(err, result) {
                    payload = {
                        'type': 'rpc-return',
                        'data': result,
                        'signature': data.signature,
                        'orig': this.id
                    };
                    __scope_35__._log('Sending payload: ', payload);
                    connection.send(payload);
                });
                __scope_36__.scope[data.func].apply(__scope_36__.scope, data.args);
            } else {
                var payload = {
                    'type': 'rpc-return',
                    'data': new Error('unknown function'),
                    'signature': data.signature,
                    'orig': __scope_36__.id
                };
                __scope_36__._log('Sending payload: ', payload);
                connection.send(payload);
            }
        }
    };
};


module.exports = RPC;