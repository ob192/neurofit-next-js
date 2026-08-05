# NeuroFit — develop the site, ship the bot.
#
# Only the bot is containerised. The website is a static Next.js build deployed
# by its host, so it has no image here; `make dev` / `make check` cover it.
#
# Release a new version:  make deploy VERSION=0.2.0
#
# Nothing here bakes bot/.env into an image. The token and group id are passed
# at *run* time — an image on Docker Hub is world-readable if the repo is
# public, and `docker history` exposes build args.

# Absolute, so the docker targets work from any directory.
ROOT := $(patsubst %/,%,$(dir $(abspath $(lastword $(MAKEFILE_LIST)))))

DOCKER_USER ?= sasha192bunin
BOT_IMAGE   := $(DOCKER_USER)/neurofit-bot

GIT_SHA   := $(shell git -C $(ROOT) rev-parse --short HEAD 2>/dev/null || echo unknown)
GIT_DIRTY := $(if $(shell git -C $(ROOT) status --porcelain 2>/dev/null),-dirty)

# The version the studio decides on, in bot/VERSION. Overriding it on the
# command line releases that version *and* records it in the file, so the file
# is always what was last shipped.
VERSION ?= $(shell cat $(ROOT)/bot/VERSION)

# The exact build. A version can be rebuilt — a bugfix, a copy change, a
# rebuild on a different day — and each rebuild gets its own immutable tag,
# so "which build of 0.1.0 is running?" stays answerable.
BUILD := $(VERSION)-$(GIT_SHA)$(GIT_DIRTY)

# Three tags, deliberately:
#
#   :0.1.0            what you deploy and redeploy. Stable name, moves only
#                     when you rebuild that version on purpose.
#   :0.1.0-a10a373    the exact build. Never reused.
#   :latest           whatever was pushed last. Convenience, not a deploy target.
#
# Version first, then the build, because that is the order you reason in: pick
# a version to run, then pin the build of it if you need to be precise.
TAGS := $(VERSION) $(BUILD) latest

.DEFAULT_GOAL := help

# ---- Help ------------------------------------------------------------------

.PHONY: help
help: ## Show this help
	@echo "NeuroFit — $(BOT_IMAGE):$(TAG)"
	@echo
	@grep -hE '^[a-zA-Z0-9_-]+:.*?## ' $(MAKEFILE_LIST) \
		| awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-14s\033[0m %s\n", $$1, $$2}'

# ---- Development -----------------------------------------------------------

.PHONY: install
install: ## Install both toolchains
	cd $(ROOT)/web && npm ci
	cd $(ROOT)/bot && python3 -m pip install -r requirements.txt

.PHONY: dev
dev: ## Run the site locally on :3000
	cd $(ROOT)/web && npm run dev

.PHONY: dev-bot
dev-bot: ## Run the bot locally against bot/.env
	cd $(ROOT)/bot && python3 -m app

.PHONY: check
check: ## Lint + typecheck the site, compile-check the bot
	cd $(ROOT)/web && npm run lint && npm run typecheck
	cd $(ROOT)/bot && python3 -m compileall -q app && echo "bot: compiles clean"

.PHONY: build-site
build-site: ## Production build of the site
	cd $(ROOT)/web && npm run build

# ---- Bot image -------------------------------------------------------------

.PHONY: version
version: ## Print the current version
	@echo $(VERSION)

.PHONY: tags
tags: ## Show the tags a deploy would publish
	@for t in $(TAGS); do echo "  $(BOT_IMAGE):$$t"; done
	@$(if $(GIT_DIRTY),echo "  working tree is dirty — build tagged $(GIT_DIRTY)",true)

.PHONY: build
build: ## Build the bot image
	docker build $(foreach t,$(TAGS),-t $(BOT_IMAGE):$(t)) \
		--build-arg BOT_VERSION=$(BUILD) \
		--label org.opencontainers.image.revision=$(GIT_SHA) \
		--label org.opencontainers.image.version=$(VERSION) \
		--label org.opencontainers.image.source=https://github.com/ob192/neurofit-next-js \
		$(ROOT)/bot

.PHONY: login
login: ## Log in to Docker Hub as $(DOCKER_USER)
	docker login -u $(DOCKER_USER)

.PHONY: push
push: ## Push the image built by `make build`
	@for t in $(TAGS); do docker push $(BOT_IMAGE):$$t || exit 1; done
	@echo "published $(BOT_IMAGE) as: $(TAGS)"

# Single-architecture, whatever this machine is. Multi-arch would need the
# buildx container driver, and the studio deploys to one known host — the
# complexity buys nothing. Build on a machine matching the target's arch.
# Records the version before building, so bot/VERSION always names what was
# last shipped — a released version that exists only in someone's shell history
# is not a version.
.PHONY: deploy
deploy: tags check ## Verify, build, publish
	@echo "$(VERSION)" > $(ROOT)/bot/VERSION
	@$(MAKE) --no-print-directory build push VERSION=$(VERSION)

# ---- Running ---------------------------------------------------------------

.PHONY: run
run: ## Run the image with bot/.env and a persistent state volume
	docker run --rm -it \
		--env-file $(ROOT)/bot/.env \
		-v neurofit-bot-state:/data \
		--name neurofit-bot $(BOT_IMAGE):$(VERSION)

.PHONY: up
up: ## Start the bot in the background
	docker compose up -d

.PHONY: down
down: ## Stop the bot
	docker compose down

.PHONY: logs
logs: ## Follow the bot's logs
	docker compose logs -f

# ---- Housekeeping ----------------------------------------------------------

.PHONY: clean
clean: ## Remove local images and the site's build output
	-docker image rm $(foreach t,$(TAGS),$(BOT_IMAGE):$(t)) 2>/dev/null
	rm -rf $(ROOT)/web/.next
