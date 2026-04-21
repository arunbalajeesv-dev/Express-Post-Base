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

### Public
- `GET /api/healthz`
- `POST /api/login` — returns JWT token

### Authenticated (requires `Authorization: Bearer <token>`)
- `GET /api/users`
- `GET /api/users/:id`
- `GET /api/brands`
- `POST /api/visits`

### Manager-only (authenticated + `role: manager`)
- `POST /api/create-user`
- `PUT /api/users/:id`
- `DELETE /api/users/:id`
- `POST /api/brands`

## Authentication

All protected routes require a JWT in the `Authorization` header:

```
Authorization: Bearer <token>
```

### Login

```bash
curl -X POST http://localhost:80/api/login \
  -H "Content-Type: application/json" \
  -d '{"user_id":"admin01","password":"manager123"}'
```

Response:
```json
{
  "message": "Login successful",
  "token": "<jwt>",
  "user": { "id": 1, "name": "Admin Manager", "userId": "admin01", "role": "manager", "mobile": "..." }
}
```

### Create User (manager only)

```bash
curl -X POST http://localhost:80/api/create-user \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"name":"Sales Agent","mobile":"8888888888","role":"sales","userId":"agent01","password":"agent123"}'
```
