var sha1 = require("sha1");
var Promise = require("bluebird");
try {
    var Peer = require('peerjs');
} catch (error) {
    Peer = undefined;
}



function RPC(id, scope, options) {
    if ((typeof window !== "undefined" && this === window) || (typeof self !== "undefined" && this === self)) {
        throw new TypeError("Tried to call class RPC as a regular function. Classes can only be called with the 'new' keyword.");
    }
    var that = this;
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
            return that._onData(connection, data);
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
    return this._sendInvocation(id, payload).nodeify(callback);
};
RPC.prototype.attr = function(id, attr, callback) {
    var payload = {
        'type': 'rpc-attr',
        'attr': attr,
        'orig': this.id,
        'signature': this._createSignature(this.id, id, 'attr')
    };
    return this._sendInvocation(id, payload).nodeify(callback);
};
RPC.prototype.ping = function(id, callback) {
    var payload = {
        'type': 'rpc-ping',
        'orig': this.id,
        'signature': this._createSignature(this.id, id, 'ping')
    };
    return this._sendInvocation(id, payload).catch(function(err) {
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
        return;
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
    var that = this;
    return new Promise(function(resolve) {
        var connection = that.peer.connect(id);
        if (connection) {
            connection.on('data', function(data) {
                return that._onData(connection, data);
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
RPC.prototype._sendAnswer = function(id, payload, connection) {
    var that = this;
    var promise = null;
    if (connection) {
        promise = Promise.resolve(connection);
    } else {
        promise = that._getConnection(id);
    }

    return promise.then(function(connection) {
        connection.send(payload);
        that._log('Sending payload to "' + id + '": ', payload);
    });
};
RPC.prototype._sendInvocation = function(id, payload, connection) {
    var that = this;
    var promise = null;
    if (connection) {
        promise = Promise.resolve(connection);
    } else {
        promise = that._getConnection(id);
    }

    return promise.then(function(connection) {
        return new Promise(function(resolve, reject) {
            that._timeouts[payload.signature] = setTimeout(function() {
                reject(new Error('Message timed out.'));
            }, that.timeout);
            that._callbacks[payload.signature] = function(result) {
                clearTimeout(that._timeouts[payload.signature]);
                if (result instanceof Error) {
                    reject(result);
                } else {
                    resolve(result);
                }
            };
            connection.send(payload);
        });
    }).then(function(value) {
        that._log('Sending payload to "' + id + '": ', payload);
        return value;
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
    var that = this;
    return {
        'rpc-ping': function(connection, data) {
            var payload = {
                'type': 'rpc-pong',
                'signature': data.signature,
                'orig': that.id
            };
            that._sendAnswer(data.orig, payload, connection);
        },
        'rpc-attr': function(connection, data) {
            var payload = {
                'type': 'rpc-attr-return',
                'data': that.scope[data.attr],
                'signature': data.signature,
                'orig': that.id
            };
            that._sendAnswer(data.orig, payload, connection);
        },
        'rpc-invoke': function(connection, data) {
            if (data.func in that.scope) {
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
                        'orig': that.id
                    };
                    that._sendAnswer(data.orig, payload, connection);
                });
                that.scope[data.func].apply(that.scope, data.args);
            } else {
                var payload = {
                    'type': 'rpc-return',
                    'data': new Error('unknown function'),
                    'signature': data.signature,
                    'orig': that.id
                };
                that._sendAnswer(data.orig, payload, connection);
            }
        }
    };
};


module.exports = RPC;