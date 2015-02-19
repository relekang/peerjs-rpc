all: lib/RPC.js test/RPC-test.js

lib/RPC.js: lib/RPC.bs
	bailey -c lib

test/RPC-test.js: test/RPC-test.bs
	bailey -c test

test: lib/RPC.js test/RPC-test.js
	npm test

html-coverage:
	istanbul report html && open coverage/index.html


.PHONY: test html-coverage
