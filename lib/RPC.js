"use strict";
var sha1 = require("sha1");
var Promise = require("bluebird");
try {
    var Peer = require('peerjs');
} catch (error) { /* istanbul ignore next */
    Peer = undefined;
}



function RPC(id, scope, options) {
    /* istanbul ignore next */
    if ((typeof window !== "undefined" && this === window) || (typeof self !== "undefined" && this === self)) {
        throw new TypeError("Tried to call class RPC as a regular function. Classes can only be called with the 'new' keyword.");
    }
    var that = this;
    this._callbacks = {};
    this._timeouts = {};

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
RPC.prototype.invoke = function invoke(id, func, args, callback) {
    var that = this;
    if (!Array.isArray(args)) {
        throw new Error('args must be an array.')
    }
    if (id === that.id) {
        return new Promise(function(resolve, reject) {
            args.push(function(err, result) {
                if (err) {
                    return reject(err)
                }
                resolve(result);
            });
            that.scope[func].apply(that.scope, args);
        }).nodeify(callback);
    }

    var payload = {
        'type': 'rpc-invoke',
        'func': func,
        'args': args,
        'orig': this.id,
        'signature': this._createSignature(this.id, id, 'invoke')
    };
    return this._sendInvocation(id, payload).nodeify(callback);
};
RPC.prototype.attr = function attr(id, attr, callback) {
    if (id === this.id) {
        return Promise.resolve(this.scope[attr]).nodeify(callback);
    }

    var payload = {
        'type': 'rpc-attr',
        'attr': attr,
        'orig': this.id,
        'signature': this._createSignature(this.id, id, 'attr')
    };
    return this._sendInvocation(id, payload).nodeify(callback);
};
RPC.prototype.ping = function ping(id, callback) {
    if (id === this.id) {
        return Promise.resolve(true).nodeify(callback);
    }

    var payload = {
        'type': 'rpc-ping',
        'orig': this.id,
        'signature': this._createSignature(this.id, id, 'ping')
    };
    return this._sendInvocation(id, payload).catch(function(error) {
        if (error.message.match(/timed out/)) {
            return false;
        }
        throw error;
    }).nodeify(callback);
};
RPC.prototype._createSignature = function _createSignature(from, to, func) {
    return sha1('' + Date.now() + ':' + from + ':' + to + ':' + func + '');
};
RPC.prototype._onData = function _onData(connection, data) {
    if (!'type' in data) {
        return;
    }

    this._log('Received data: ', data);

    if (data.type.match(/^rpc-(:?ping|attr|invoke)$/)) {
        this._handlers()[data.type].bind(this)(connection, data);
    } else {
        if (data.type.match(/return/)) {
            this._callbacks[data.signature](data.error, data.data);
        } else {
            if (data.type.match(/pong/)) {
                this._callbacks[data.signature](data.error, true);
            }
        }
    }
};
RPC.prototype._getConnection = function _getConnection(id) {
    var that = this;
    return new Promise(function(resolve) {
        if (that.peer.connections.hasOwnProperty(id) && that.peer.connections.hasOwnProperty(id)) {
            connection = that.peer.connections[id][0];
            if (connection.open) {
                return resolve(connection)
            }
        }

        var connection = that.peer.connect(id);
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
    });
};
RPC.prototype._sendAnswer = function _sendAnswer(id, payload, connection) {
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
RPC.prototype._sendInvocation = function _sendInvocation(id, payload, connection) {
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

            that._callbacks[payload.signature] = function(err, result) {
                clearTimeout(that._timeouts[payload.signature]);
                if (err) {
                    reject(err);
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
RPC.prototype._log = function _log(message, obj) {
    if (!this.debug) {
        return;
    }
    var CircularJSON = require('circular-json');
    console.log('RPC:  ' + message + ' ' + CircularJSON.stringify(obj) + '');
};
RPC.prototype._handlers = function _handlers() {
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
                data.args.push(function(error, result) {
                    payload = {
                        'type': 'rpc-return',
                        'data': result || null,
                        'error': null,
                        'signature': data.signature,
                        'orig': that.id
                    };
                    if (error) {
                        payload.error = error;
                    }
                    that._sendAnswer(data.orig, payload, connection);
                });
                that.scope[data.func].apply(that.scope, data.args);
            } else {
                var payload = {
                    'type': 'rpc-return',
                    'data': null,
                    'error': new Error('unknown function'),
                    'signature': data.signature,
                    'orig': that.id
                };
                that._sendAnswer(data.orig, payload, connection);
            }
        }
    };
};


module.exports = RPC;
