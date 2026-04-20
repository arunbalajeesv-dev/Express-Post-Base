# API Server

Node.js Express backend with PostgreSQL, organized into routes, controllers, models, middleware, and shared database schema files.

## Structure

- `src/app.ts` — Express app setup
- `src/index.ts` — server entry point
- `src/routes` — REST API routes
- `src/controllers` — request handlers
- `src/models` — database access logic
- `src/middlewares` — error and not-found handling
- `../../lib/db/src/schema` — PostgreSQL table schemas

## Requirements

PostgreSQL must be available through `DATABASE_URL`.

## Run locally

From the project root:

```bash
pnpm --filter @workspace/db run push
pnpm --filter @workspace/api-server run dev
```

## API endpoints

- `GET /api/healthz`
- `GET /api/users`
- `POST /api/users`
- `GET /api/users/:id`
- `PUT /api/users/:id`
- `DELETE /api/users/:id`

Example request:

```bash
curl -X POST http://localhost:80/api/users \
  -H "Content-Type: application/json" \
  -d '{"name":"Example User","email":"example-user@example.com"}'
```
