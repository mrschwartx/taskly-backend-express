COMPOSE_DEV = docker compose -f docker-compose.dev.yml
COMPOSE_LOCAL = docker compose -f docker-compose.local.yml

.DEFAULT_GOAL := help
.PHONY: help env dev-up dev-down dev-logs local-build local-up local-down local-logs local-ps local-seed local-clean

help:
	@echo "env          create .env with generated secrets"
	@echo "dev-up       start MongoDB and Mongo Express for local development"
	@echo "dev-down     stop the development services"
	@echo "dev-logs     follow development service logs"
	@echo "local-build  build the backend image"
	@echo "local-up     build and start MongoDB and the backend"
	@echo "local-down   stop the stack"
	@echo "local-logs   follow the stack logs"
	@echo "local-ps     show stack status"
	@echo "local-seed   seed demo users and tasks"
	@echo "local-clean  stop the stack and remove volumes and images"

env:
	@test -f .env || { \
		cp .env.example .env; \
		sed -i.bak "s|^MONGO_PASSWORD=.*|MONGO_PASSWORD=$$(openssl rand -hex 16)|; s|^AUTH_SECRET=.*|AUTH_SECRET=$$(openssl rand -hex 32)|" .env; \
		rm -f .env.bak; \
		echo "Created .env with generated secrets"; \
	}

dev-up:
	$(COMPOSE_DEV) up -d

dev-down:
	$(COMPOSE_DEV) down

dev-logs:
	$(COMPOSE_DEV) logs -f

local-build: env
	$(COMPOSE_LOCAL) build

local-up: env
	$(COMPOSE_LOCAL) up -d --build --wait

local-down:
	$(COMPOSE_LOCAL) down

local-logs:
	$(COMPOSE_LOCAL) logs -f

local-ps:
	$(COMPOSE_LOCAL) ps

local-seed:
	$(COMPOSE_LOCAL) exec taskly-backend node src/scripts/seed.js

local-clean:
	$(COMPOSE_LOCAL) down -v --rmi local
