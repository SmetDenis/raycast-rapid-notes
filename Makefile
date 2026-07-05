# Thin façade over the npm scripts. package.json scripts stay canonical
# (ray / Raycast / the Store publish flow depend on them) — do not duplicate logic here.

.PHONY: dev build lint fix test test-watch check install publish clean

dev: ; npm run dev
build: ; npm run build
lint: ; npm run lint
fix: ; npm run fix-lint
test: ; npm test
test-watch: ; npm run test:watch
install: ; npm install
publish: ; npm run publish

check: lint test build

clean: ; rm -rf node_modules dist
