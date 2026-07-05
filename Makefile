# Thin façade over the npm scripts. package.json scripts stay canonical
# (ray / Raycast / the Store publish flow depend on them) — do not duplicate logic here.
# `make` with no target prints help; keep a `## ` description on every target.

.DEFAULT_GOAL := help
.PHONY: help dev build lint fix test test-watch check install publish clean

help: ## Show this help
	@grep -hE '^[a-zA-Z_-]+:.*## ' $(MAKEFILE_LIST) | sort | \
		awk 'BEGIN {FS = ":.*## "}; {printf "  \033[36m%-12s\033[0m %s\n", $$1, $$2}'

dev: ## Live reload in Raycast (ray develop)
	npm run dev

build: ## Compile check (ray build)
	npm run build

lint: ## Lint (ray lint)
	npm run lint

fix: ## Autofix lint (ray lint --fix)
	npm run fix-lint

test: ## Run unit tests (vitest run)
	npm test

test-watch: ## Run unit tests in watch mode
	npm run test:watch

check: lint test build ## Pre-finish gate: lint + test + build

install: ## Install dependencies (npm install)
	npm install

publish: ## Publish to the Raycast Store (ray publish)
	npm run publish

clean: ## Remove node_modules and dist
	rm -rf node_modules dist
