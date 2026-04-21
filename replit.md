# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

## API Server Structure

- `artifacts/api-server/src/app.ts` — Express app setup, JSON parsing, CORS, logging, routes, and error handling
- `artifacts/api-server/src/routes` — REST route definitions
- `artifacts/api-server/src/controllers` — request handlers
- `artifacts/api-server/src/models` — PostgreSQL data access
- `artifacts/api-server/src/middlewares` — shared Express middleware
- `lib/db/src/schema` — Drizzle PostgreSQL table schemas
- `lib/db/sql/create_tables.sql` — SQL statements to create Users, Customers, Visits, and Followups tables
- Brands management uses `brands` and `visit_brands` tables, with API routes at `/api/brands` and visit creation at `/api/visits`.
- Authentication uses JWT (`JWT_SECRET` env var). `POST /api/login` is public. All other routes require `Authorization: Bearer <token>`. `POST /api/create-user` and manager mutations require `role: manager` in the JWT payload.
- Passwords are hashed with bcryptjs (10 rounds) on creation.

## Run Instructions

1. Ensure PostgreSQL is provisioned so `DATABASE_URL` is available.
2. Push the database schema with `pnpm --filter @workspace/db run push`.
3. Start the API server with `pnpm --filter @workspace/api-server run dev`.
4. Use `/api/healthz` for health checks and `/api/users` for the sample REST resource.

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
