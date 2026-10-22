# Taskly (Express)

A task manager backend: sign up and sign in, manage your profile and avatar, and create, filter, sort and paginate to-do tasks. It is a REST API built with Express 5 and MongoDB, organised as a modular monolith with Domain-Driven Design and Clean Architecture.

The browser client is a separate Taskly frontend that talks to this API.

**Stack:** Node.js 22 · Express 5 · MongoDB · JWT · bcrypt · Multer · Winston · node:test · ESLint · Prettier · Docker · GitHub Actions

## Contents

- [Quick start](#quick-start)
- [Features](#features)
- [Configuration](#configuration)
- [Architecture](#architecture)
- [API](#api)
- [Testing](#testing)
- [CI](#ci)
- [Limits](#limits)
- [References](#references)

## Quick start

Requires Node.js 22+ and a running MongoDB.

```sh
cd taskly-docker
make docker/dev-up
cd ../taskly-backend
cp .env.example .env
npm ci
npm run secret-key
npm run dev
```

Paste the generated value into `AUTH_SECRET` in `.env`. The API runs at http://localhost:8080 and Mongo Express at http://localhost:8081.

| Goal                  | Command                                       |
| --------------------- | --------------------------------------------- |
| Run in development    | `npm run dev`                                 |
| Run in production     | `npm start`                                   |
| Seed demo data        | `npm run seed`                                |
| Run with Docker       | `make docker/up` (from `taskly-docker`)       |
| Seed in Docker        | `make docker/seed` (from `taskly-docker`)     |
| Stop Docker           | `make docker/down` (from `taskly-docker`)     |

`make docker/up` generates `taskly-docker/.env` with random secrets on the first run. `PORT` overrides the host port in the Docker setup. The container always listens on port 8080. Demo login after seeding: `johndoe123@mail.com` / `password123`.

## Features

- **Authentication**: sign up, sign in and sign out with a JWT stored in an HTTP-only cookie.
- **Users**: list users, update the profile, upload an avatar and delete the account.
- **Tasks**: create, view, update and delete tasks.
- **Listing**: filter by status, sort and paginate tasks.
- **Platform**: structured logging, graceful shutdown, health check on `/` in the Docker image.

## Configuration

| Variable        | Default                 | Purpose                                 |
| --------------- | ----------------------- | --------------------------------------- |
| `APP_NAME`      | `taskly-api`            | Application name                        |
| `APP_HOST`      | `0.0.0.0`               | Bind address                            |
| `APP_PORT`      | `8080`                  | Port the API listens on                 |
| `APP_LEVEL`     | `development`           | Environment level                       |
| `MONGO_URI`     | required                | MongoDB connection string               |
| `MONGO_DB`      | `taskly`                | Database name                           |
| `MONGO_TIMEOUT` | `30000`                 | MongoDB timeout in milliseconds         |
| `AUTH_SECRET`   | required                | JWT secret, at least 32 characters      |
| `COOKIE_DOMAIN` | empty                   | Domain of the auth cookie               |
| `BCRYPT_ROUNDS` | `10`                    | bcrypt cost factor                      |
| `CLIENT_URL`    | `http://localhost:3000` | Allowed CORS origin                     |
| `LOG_LEVEL`     | `debug`                 | Log level                               |
| `LOG_TO_FILE`   | `true`                  | Write logs to the `logs` directory      |
| `PORT`          | `8080`                  | Host port used by Docker                |

The frontend must set `VITE_API_BASE_URL=http://localhost:8080/api/v1` and `VITE_SERVER_BASE_URL=http://localhost:8080`.

## Architecture

### Project layout

```
taskly-backend/
  src/
    bootstrap/   composition root, app and server factories
    config/      environment parsing and validation
    shared/      errors, event bus, logging, HTTP and Mongo helpers
    modules/     users, tasks
    scripts/     seed
  test/          unit, integration and e2e suites
taskly-docker/
  taskly-backend/Dockerfile
  docker-compose.local.yml
  docker-compose.dev.yml
  Makefile
.github/workflows/ci.yml
```

### Module layout

```
modules/<name>/
  domain/          entities, value objects, repository contracts
  application/     use cases
  infrastructure/  MongoDB and other adapters
  presentation/    Express routers and controllers
  index.js         public API
```

### Dependency rules

- Dependencies point inward: presentation and infrastructure depend on application, application depends on domain.
- Modules never import each other. They communicate through the in-process event bus, so deleting a user removes that user's tasks.

## API

All routes are under `/api/v1`. Routes other than sign up and sign in require the `taskly_token` cookie.

| Method | Path                | Purpose                                        |
| ------ | ------------------- | ---------------------------------------------- |
| POST   | `/auth/signup`      | Register and sign in                           |
| POST   | `/auth/signin`      | Sign in                                        |
| GET    | `/auth/signout`     | Sign out                                       |
| GET    | `/users`            | List users, filter with `username` and `email` |
| GET    | `/users/:id`        | Get a user                                     |
| PATCH  | `/users/update/:id` | Update own profile                             |
| POST   | `/users/upload/:id` | Upload own avatar (`avatar` field, 2 MB)       |
| DELETE | `/users/delete/:id` | Delete own account                             |
| POST   | `/tasks/create`     | Create a task                                  |
| GET    | `/tasks/user/:id`   | List own tasks with `status`, `orderBy`, `page` |
| GET    | `/tasks/:id`        | Get a task                                     |
| PATCH  | `/tasks/:id`        | Update a task                                  |
| DELETE | `/tasks/:id`        | Delete a task                                  |

## Testing

| Layer       | Command                    | What it proves                                   |
| ----------- | -------------------------- | ------------------------------------------------ |
| Unit        | `npm run test:unit`        | Domain and use cases, no I/O                     |
| Integration | `npm run test:integration` | Repositories and HTTP modules on a real MongoDB  |
| E2E         | `npm run test:e2e`         | Full flows against the real server process       |
| Coverage    | `npm run test:coverage`    | All tests with coverage                          |

Integration and e2e tests use `TEST_MONGO_URI` when set. Otherwise they download and start an in-memory MongoDB. Other checks: `npm run lint`, `npm run format:check`.

## CI

`.github/workflows/ci.yml` runs these jobs:

1. **Quality**: lint, format check, unit and integration tests with coverage.
2. **E2E**: the end-to-end suite against MongoDB.
3. **Docker**: image build plus a smoke test that checks `/` and signs up a user on port 8080.
4. **Commitlint**: commit message linting on pull requests, configured in `.commitlintrc.json`.

## Limits

- The API needs a running MongoDB.
- Uploaded avatars are stored on local disk and served from `/images/users`.
- Events are delivered in-process, so the app runs as a single instance.

## References

- [Express](https://expressjs.com)
- [MongoDB Node.js driver](https://www.mongodb.com/docs/drivers/node/current/)
- [JSON Web Tokens](https://jwt.io)
- [Node.js test runner](https://nodejs.org/api/test.html)
- [ESLint](https://eslint.org) · [Prettier](https://prettier.io)
- [Docker multi-stage builds](https://docs.docker.com/build/building/multi-stage/)
