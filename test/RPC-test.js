var __module_chai = require("chai");
var mr = require("mock-require");
var PeerMock = require("peerjs-mock");
var expect = __module_chai.expect;

mr('peerjs', PeerMock);

var RPC = require('../lib/RPC');

describe('RPC', function() {
    var scope = {
        'ping': function(arg, callback) {
            return callback(null, 'pong: ' + arg + '');
        },
        'answer': 42
    };

    var n1 = null;
    var n2 = null;

    beforeEach(function() {
        n1 = new RPC('n1', scope);
        n2 = new RPC('n2', scope);
    });

    it('should ping and receive pong', function(done) {
        n1.ping('n2', function(result) {
            expect(result).to.be.truthy;
            done();
        });
    });

    it('should invoke and return value', function(done) {
        n1.invoke('n2', 'ping', '42', function(err, result) {
            if (err) {
                done(err);
            }

            expect(result).to.equal('pong: 42');
            done();
        });
    });

    it('should return attribute value', function(done) {
        n1.attr('n2', 'answer', function(err, result) {
            if (err) {
                done(err);
            }

            expect(result).to.equal(42);
            done();
        });
    });
});


module.exports = {
    'mr': mr,
    'PeerMock': PeerMock,
    'RPC': RPC,
    'expect': expect
};