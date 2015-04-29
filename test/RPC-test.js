"use strict";
var __module_chai = require("chai");
var Promise = require("bluebird");
var mr = require("mock-require");
var PeerMock = require("peerjs-mock");
var expect = __module_chai.expect;

mr('peerjs', PeerMock);
Promise.longStackTraces();

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
        'error': function(callback) {
            return callback(new Error('this is an error'));
        },
        'answer': 42
    };

    var n1 = null;
    var n2 = null;

    beforeEach(function() {
        n1 = new RPC('n1', scope, {
            'debug': false
        });
        n2 = new RPC('n2', scope, {
            'debug': false
        });
    });

    describe('.invoke()', function() {
        it('should only accept list as argument', function() {
            expect(function() {
                return n2.invoke('n1', 'pinger');
            }).to.throw(Error, 'args must be an array.');
        });
    });

    describe('using callbacks', function() {
        it('should ping and receive pong', function(done) {
            n1.ping('n2', function(err, result) {
                expect(result).to.be.truthy;
                done();
            });
        });

        it('should return false if ping times out', function(done) {
            var n = new RPC('n', scope, {
                'timeout': 1
            });
            n.ping('n2', function(err, result) {
                expect(result).to.be.false;
                done();
            });
        });

        it('should reject with error from ping', function(done) {
            n1._handlers = function _handlers() {
                return {
                    'rpc-ping': function(connection, data) {
                        var payload = {
                            'type': 'rpc-pong',
                            'signature': data.signature,
                            'error': new Error('an error')
                        };
                        n1._sendAnswer(data.orig, payload, connection);
                    }
                };
            };
            n2.ping('n1', function(err, callback) {
                expect(err.message).to.equal('an error');
                done();
            });
        });

        it('should invoke with no arguments and return value', function(done) {
            n1.invoke('n2', 'pinger', [], function(err, result) {
                if (err) {
                    return done(err)
                }

                expect(result).to.equal('pong');
                done();
            });
        });

        it('should invoke with one argument and return value', function(done) {
            n1.invoke('n2', 'ping', ['42'], function(err, result) {
                if (err) {
                    return done(err)
                }

                expect(result).to.equal('pong: 42');
                done();
            });
        });

        it('should return error of invoked function', function(done) {
            n1.invoke('n2', 'error', [], function(err, result) {
                expect(err.message).to.equal('this is an error');
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
            n1.invoke('n2', 'getAnswer', [], function(err, result) {
                if (err) {
                    return done(err)
                }

                expect(result).to.equal(42);
                done();
            });
        });

        it('should return error if the function does not exits', function(done) {
            n1.invoke('n2', 'non-existing-function', [], function(err, result) {
                expect(err.message).to.equal('unknown function');
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
            return n1.ping('n2').then(function(result) {
                expect(result).to.be.true;
            });
        });

        it('should return false if ping times out', function() {
            var n = new RPC('n', scope, {
                'timeout': 1
            });
            return n.ping('n2').then(function(result) {
                expect(result).to.be.false;
            });
        });

        it('should reject with error from ping', function() {
            n1._handlers = function _handlers() {
                return {
                    'rpc-ping': function(connection, data) {
                        var payload = {
                            'type': 'rpc-pong',
                            'signature': data.signature,
                            'error': new Error('an error')
                        };
                        n1._sendAnswer(data.orig, payload, connection);
                    }
                };
            };
            var catched = false;
            return n2.ping('n1').catch(function(err) {
                catched = true;
                expect(err.message).to.equal('an error');
            }).then(function() {
                expect(catched).to.be.true;
            });
        });

        it('should invoke with no arguments and return value', function() {
            return n1.invoke('n2', 'pinger', []).then(function(result) {
                expect(result).to.equal('pong');
            });
        });

        it('should invoke with one argument and return value', function() {
            return n1.invoke('n2', 'ping', ['42']).then(function(result) {
                expect(result).to.equal('pong: 42');
            });
        });

        it('should return error of invoked function', function() {
            var catched = false;
            return n1.invoke('n2', 'error', []).catch(function(error) {
                expect(error.message).to.equal('this is an error');
                catched = true;
            }).then(function() {
                return expect(catched).to.be.true;
            });
        });

        it('should invoke with multiple arguments and return value', function() {
            return n1.invoke('n2', 'add', [40, 2]).then(function(result) {
                expect(result).to.equal(42);
            });
        });

        it('should be able to reference scope in invoked functions', function() {
            return n1.invoke('n2', 'getAnswer', []).then(function(result) {
                expect(result).to.equal(42);
            });
        });

        it('should return error if the function does not exits', function() {
            var catched = false;
            return n1.invoke('n2', 'non-existing-function', []).catch(function(err) {
                expect(err.message).to.equal('unknown function');
                catched = true;
            }).then(function() {
                return expect(catched).to.be.true;
            });
        });

        it('should return attribute value', function() {
            return n1.attr('n2', 'answer').then(function(result) {
                expect(result).to.equal(42);
            });
        });
    });
});


module.exports = {
    'Promise': Promise,
    'mr': mr,
    'PeerMock': PeerMock,
    'RPC': RPC,
    'expect': expect
};