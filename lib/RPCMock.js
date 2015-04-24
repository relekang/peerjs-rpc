var Promise = require("bluebird");
var RPC = require("./RPC");

var mocks = {};

function RPCMock(id, scope) {
    if ((typeof window !== "undefined" && this === window) || (typeof self !== "undefined" && this === self)) {
        throw new TypeError("Tried to call class RPCMock as a regular function. Classes can only be called with the 'new' keyword.");
    }
    this.id = id;
    this.scope = scope;
    mocks[id] = this;
    this.delays = {};
}
RPCMock.prototype = Object.create(RPC.prototype);
RPCMock.prototype._sendInvocation = function(id, payload, connection) {
    var that = this;
    var delay = 0;
    if (id in this.delays) {
        delay = this.delays[id];
    }
    return new Promise(function(resolve, reject) {
        setTimeout(function() {
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
            mocks[id]._onData(null, payload);
        }, delay);
    });
};
RPCMock.prototype._sendAnswer = function(id, payload, connection) {
    var delay = 0;
    if (id in this.delays) {
        delay = this.delays[id];
    }
    return new Promise(function(resolve) {
        setTimeout(function() {
            resolve(mocks[id]._onData(null, payload));
        }, delay);
    });
};


module.exports = RPCMock;