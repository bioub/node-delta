BROWSER=firefox
JSCOV=jscoverage
JSDOC=/home/lo/sw/jsdoc-3/jsdoc
JSDOCTK=/home/lo/sw/jsdoc-toolkit
BROWSERIFY=node_modules/.bin/browserify

test:
	node test.js

browser:
	$(BROWSERIFY) --ignore fixtures --plugin 'fileify:["fixtures", "test/fixtures"]' test-browserify-entry.js > dist/browser-test/deltajs-test.js
	$(BROWSERIFY) deltajs-browserify-entry.js > dist/browser/delta.js
	$(BROWSERIFY) deltajs-browserify-entry.js > dist/browser/delta.js
	$(BROWSERIFY) examples/srcdiff/srcdiff-entry.js > examples/srcdiff/srcdiff.js

examples: browser
	cp dist/browser/delta.js examples/xcc/delta.js
	cp dist/browser/delta.js examples/lcs/delta.js

browser-coverage: browser
	$(JSCOV) dist/browser-test dist/browser-test-cov

browser-test: browser
	 $(BROWSER) dist/browser-test/test.html >/dev/null 2>&1 &

jsdoc:
	java -jar $(JSDOCTK)/jsrun.jar $(JSDOCTK)/app/run.js --verbose --recursive --template=./doc/_themes/jsdoc-for-sphinx/ --directory=./doc/jsdoc/ ./lib/delta/

doc: jsdoc
	(cd doc && make html)

.PHONY: test browser-test
