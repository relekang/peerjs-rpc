all: lib/RPC.js test/RPC-test.js

lib/RPC.js: lib/RPC.bs
	bailey -c lib

test/RPC-test.js: test/RPC-test.bs
	bailey -c test

test: lib/RPC.js test/RPC-test.js
	npm test

mocha: lib/RPC.js test/RPC-test.js
	node_modules/.bin/mocha 

html-coverage:
	istanbul report html && open coverage/index.html


.PHONY: test html-coverage
