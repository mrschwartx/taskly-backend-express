COMPOSE = docker compose -f docker-compose.local.yml
COMPOSE_DEV = docker compose -f docker-compose.dev.yml

.PHONY: docker/env docker/build docker/up docker/down docker/logs docker/ps docker/seed docker/clean docker/dev-up docker/dev-down docker/dev-logs

docker/env:
	@test -f .env || { \
		cp .env.example .env; \
		sed -i.bak "s|^MONGO_PASSWORD=.*|MONGO_PASSWORD=$$(openssl rand -hex 16)|; s|^AUTH_SECRET=.*|AUTH_SECRET=$$(openssl rand -hex 32)|" .env; \
		rm -f .env.bak; \
		echo "Created .env with generated secrets"; \
	}

docker/build: docker/env
	$(COMPOSE) build

docker/up: docker/env
	$(COMPOSE) up -d --build --wait

docker/down:
	$(COMPOSE) down

docker/logs:
	$(COMPOSE) logs -f taskly-backend

docker/ps:
	$(COMPOSE) ps

docker/seed:
	$(COMPOSE) exec taskly-backend node src/scripts/seed.js

docker/clean:
	$(COMPOSE) down -v --rmi local

docker/dev-up:
	$(COMPOSE_DEV) up -d

docker/dev-down:
	$(COMPOSE_DEV) down

docker/dev-logs:
	$(COMPOSE_DEV) logs -f
