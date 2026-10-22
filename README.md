# Taskly Backend

Task management REST API built with Express 5, MongoDB and JavaScript. It is a modular monolith designed with Domain-Driven Design and Clean Architecture.

## Repository layout

| Path | Purpose |
| --- | --- |
| `taskly-backend-express` | API source code and tests |
| `taskly-docker` | Dockerfile, Compose files and Makefile |
| `.github/workflows/ci.yml` | Lint, test and Docker smoke test pipeline |

## Quick start with Docker

```bash
cd taskly-docker
make local-up
make local-seed
curl http://localhost:8000/
```

`make local-up` generates a `.env` with random secrets on the first run. Demo login after seeding: `johndoe123@mail.com` / `password123`.

## Local development

```bash
cd taskly-docker && make dev-up
cd ../taskly-backend-express
cp .env.example .env
npm install
npm run secret-key
npm run dev
```

Paste the generated value into `AUTH_SECRET` in `.env`. Mongo Express is available at http://localhost:8081.

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start with auto reload |
| `npm start` | Start in production mode |
| `npm run seed` | Insert demo users and tasks |
| `npm run test:unit` | Domain and use case tests, no I/O |
| `npm run test:integration` | Repositories and HTTP modules on a real MongoDB |
| `npm run test:e2e` | Full flows against the real server process |
| `npm run lint` / `npm run format:check` | Static checks |

Integration and e2e tests use `TEST_MONGO_URI` when set. Otherwise they download and start an in-memory MongoDB.

## Architecture

```
src/
  bootstrap/        composition root, app and server factories
  config/           environment parsing and validation
  shared/           errors, event bus, logging, HTTP and Mongo helpers
  modules/
    users/          authentication, profiles and avatars
    tasks/          task management
      domain/          entities, value objects, repository contracts
      application/     use cases
      infrastructure/  MongoDB and other adapters
      presentation/    Express routers and controllers
```

Dependencies point inward: presentation and infrastructure depend on application, application depends on domain. Modules never import each other. They communicate through the in-process event bus, so deleting a user removes that user's tasks.

## API

All routes are under `/api/v1`. Routes other than sign up and sign in require the `taskly_token` cookie.

| Method | Path | Description |
| --- | --- | --- |
| POST | `/auth/signup` | Register and sign in |
| POST | `/auth/signin` | Sign in |
| GET | `/auth/signout` | Sign out |
| GET | `/users` | List users, filter with `username` and `email` |
| GET | `/users/:id` | Get a user |
| PATCH | `/users/update/:id` | Update own profile |
| POST | `/users/upload/:id` | Upload own avatar (`avatar` field, 2 MB) |
| DELETE | `/users/delete/:id` | Delete own account |
| POST | `/tasks/create` | Create a task |
| GET | `/tasks/user/:id` | List own tasks, `status`, `orderBy`, `page` |
| GET | `/tasks/:id` | Get a task |
| PATCH | `/tasks/:id` | Update a task |
| DELETE | `/tasks/:id` | Delete a task |

## Configuration

See `taskly-backend-express/.env.example`. `AUTH_SECRET` (at least 32 characters) and `MONGO_URI` are required.
