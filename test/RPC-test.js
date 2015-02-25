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
        'pinger': function(callback) {
            return callback(null, 'pong');
        },
        'add': function(arg1, arg2, callback) {
            return callback(null, arg1 + arg2);
        },
        'getAnswer': function(callback) {
            return callback(null, this.answer);
        },
        'answer': 42
    };

    var n1 = null;
    var n2 = null;

    beforeEach(function() {
        n1 = new RPC('n1', scope);
        n2 = new RPC('n2', scope);
    });

    describe('using callbacks', function() {
        it('should ping and receive pong', function(done) {
            n1.ping('n2', function(result) {
                expect(result).to.be.truthy;
                done();
            });
        });

        it('should invoke with no arguments and return value', function(done) {
            n1.invoke('n2', 'pinger', undefined, function(err, result) {
                if (err) {
                    return done(err)
                }

                expect(result).to.equal('pong');
                done();
            });
        });

        it('should invoke with one argument and return value', function(done) {
            n1.invoke('n2', 'ping', '42', function(err, result) {
                if (err) {
                    return done(err)
                }

                expect(result).to.equal('pong: 42');
                done();
            });
        });

        it('should invoke with multiple arguments and return value', function(done) {
            n1.invoke('n2', 'add', [40, 2], function(err, result) {
                if (err) {
                    return done(err)
                }

                expect(result).to.equal(42);
                done();
            });
        });

        it('should be able to reference scope in invoked functions', function(done) {
            n1.invoke('n2', 'getAnswer', undefined, function(err, result) {
                if (err) {
                    return done(err)
                }

                expect(result).to.equal(42);
                done();
            });
        });


        it('should return attribute value', function(done) {
            n1.attr('n2', 'answer', function(err, result) {
                if (err) {
                    return done(err)
                }

                expect(result).to.equal(42);
                done();
            });
        });
    });

    describe('using promises', function() {
        it('should ping and receive pong', function() {
            n1.ping('n2').then(function(result) {
                expect(result).to.be.truthy;
            });
        });

        it('should invoke with no arguments and return value', function() {
            n1.invoke('n2', 'pinger', undefined).then(function(result) {
                expect(result).to.equal('pong');
            });
        });

        it('should invoke with one argument and return value', function() {
            n1.invoke('n2', 'ping', '42').then(function(result) {
                expect(result).to.equal('pong: 42');
            });
        });

        it('should invoke with multiple arguments and return value', function() {
            n1.invoke('n2', 'add', [40, 2]).then(function(result) {
                expect(result).to.equal(42);
            });
        });

        it('should be able to reference scope in invoked functions', function() {
            n1.invoke('n2', 'getAnswer', undefined).then(function(result) {
                expect(result).to.equal(42);
            });
        });

        it('should return attribute value', function() {
            n1.attr('n2', 'answer').then(function(result) {
                expect(result).to.equal(42);
            });
        });
    });
});


module.exports = {
    'mr': mr,
    'PeerMock': PeerMock,
    'RPC': RPC,
    'expect': expect
};