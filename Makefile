# NeuroFit — develop the site, ship the bot.
#
# Only the bot is containerised. The website is a static Next.js build deployed
# by its host, so it has no image here; `make dev` / `make check` cover it.
#
# Override anything on the command line:  make deploy TAG=2026-08-04
#
# Nothing here bakes bot/.env into an image. The token and group id are passed
# at *run* time — an image on Docker Hub is world-readable if the repo is
# public, and `docker history` exposes build args.

DOCKER_USER ?= sasha192bunin
TAG         ?= latest

BOT_IMAGE := $(DOCKER_USER)/neurofit-bot

# `latest` alongside the real tag — but not twice when TAG is already `latest`,
# which would tag and push the same reference two times.
ALSO_LATEST := $(filter-out latest,$(TAG))

# Absolute, so the docker targets work from any directory.
ROOT := $(patsubst %/,%,$(dir $(abspath $(lastword $(MAKEFILE_LIST)))))

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

.PHONY: build
build: ## Build the bot image
	docker build -t $(BOT_IMAGE):$(TAG) \
		$(if $(ALSO_LATEST),-t $(BOT_IMAGE):latest) $(ROOT)/bot

.PHONY: login
login: ## Log in to Docker Hub as $(DOCKER_USER)
	docker login -u $(DOCKER_USER)

.PHONY: push
push: ## Push the image built by `make build`
	docker push $(BOT_IMAGE):$(TAG)
	$(if $(ALSO_LATEST),docker push $(BOT_IMAGE):latest)

# Single-architecture, whatever this machine is. Multi-arch would need the
# buildx container driver, and the studio deploys to one known host — the
# complexity buys nothing. Build on a machine matching the target's arch.
.PHONY: deploy
deploy: check build push ## Verify, build, publish

# ---- Running ---------------------------------------------------------------

.PHONY: run
run: ## Run the image with bot/.env and a persistent state volume
	docker run --rm -it \
		--env-file $(ROOT)/bot/.env \
		-v neurofit-bot-state:/data \
		--name neurofit-bot $(BOT_IMAGE):$(TAG)

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
	-docker image rm $(BOT_IMAGE):$(TAG) $(BOT_IMAGE):latest 2>/dev/null
	rm -rf $(ROOT)/web/.next
