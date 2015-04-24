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
}
RPCMock.prototype = Object.create(RPC.prototype);
RPCMock.prototype._sendInvocation = function(id, payload, connection) {
    var that = this;
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
        mocks[id]._onData(null, payload);
    });
};
RPCMock.prototype._sendAnswer = function(id, payload, connection) {
    return Promise.resolve(mocks[id]._onData(null, payload));
};


module.exports = RPCMock;