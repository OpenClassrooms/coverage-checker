.PHONY: compile
compile: node_modules
	ncc build index.js --license licenses.txt

node_modules:
	npm install

.PHONY: install
install: node_modules
	npm install -g @vercel/ncc
