# peerjs-rpc [![Build status](https://ci.frigg.io/badges/relekang/peerjs-rpc/)](https://ci.frigg.io/relekang/peerjs-rpc/last/) [![Coverage status](https://ci.frigg.io/badges/coverage/relekang/peerjs-rpc/)](https://ci.frigg.io/relekang/peerjs-rpc/last/)

RPC module for WebRTC using peerjs.

## Installation

```
npm install peerjs-rpc
```

## Usage
### ping(nodeId, callback)
Calls callback with either `true` or `false`.

### attr(nodeId, attrName, callback)
Calls callback with `(err, result)`, where result is the attribute in the given scope on the remote node.

### invoke(nodeId, functionName, arguments, callback)
Calls callback with `(err, result)`, where result is the value returned by the callback given to the function in the given scope on the remote node. `arguments` can be one argument or an array with arguments.

### Examples
#### Javascript
```javascript
var RPC = require("peerjs-rpc").RPC;
var scope = {
    'hi': function(name, callback) {
        return callback("hi there " + name + "!");
    },
    'answer': 42
};

var rpc = new RPC('node-id', scope);
var rpc2 = new RPC('another-node', scope);

rpc.ping('another-node')
  .then(function(answer) {
    return console.log(answer);
});
// => true

rpc.invoke('another-node', 'hi', ['R2'])
  .then(function(answer) {
    return console.log(answer);
});
// => hi there R2!

rpc.attr('another-node', 'answer')
  .then(function(answer) {
    return console.log(answer);
});
// => 42
```

#### [Bailey.js](http://haeric.github.io/bailey.js/)
```coffee
import peerjs-rpc: RPC

scope = {
  hi: (name, callback) -> callback("hi there #{name}!")
  answer: 42
}

rpc = new RPC('node-id', scope)
rpc2 = new RPC('another-node', scope) # running on another node

rpc.ping('another-node'.then((answer) -> console.log(answer))
# => true

rpc.invoke('another-node', 'hi', ['R2']).then((answer) -> console.log(answer))
# => hi there R2!

rpc.attr('another-node', 'answer').then((answer) -> console.log(answer))
# => 42
```

----------------------

MIT © Rolf Erik Lekang
