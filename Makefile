compile:
	ncc build index.js --license licenses.txt
install: node_modules
	npm install -g @vercel/ncc
	npm install
.PHONY: compile

