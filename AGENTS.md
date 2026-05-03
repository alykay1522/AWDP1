# AGENTS.md

## Cursor Cloud specific instructions

### Overview

AWDP (All Window Door Parts) is a pnpm workspace monorepo with an Express 5 API server (`artifacts/api-server`) and a React+Vite storefront (`artifacts/awdp-site`). See `replit.md` for the full architecture and package descriptions.

### Services

| Service | How to run | Port |
|---------|-----------|------|
| PostgreSQL 16 | `service postgresql start` | 5432 |
| API Server | `pnpm --filter @workspace/api-server run dev` | 3000 (set via `PORT` env var) |
| Frontend (Vite) | `cd artifacts/awdp-site && pnpm run dev` | 5173 |

### Required environment variables

```bash
export DATABASE_URL="postgresql://awdp:awdp123@localhost:5432/awdp"
export PORT=3000
export SESSION_SECRET="dev-session-secret-12345"
export ADMIN_PASSWORD="admin123"
export STRIPE_SECRET_KEY="sk_test_placeholder"
export PAYPAL_CLIENT_ID="paypal_test_placeholder"
export PAYPAL_CLIENT_SECRET="paypal_test_placeholder"
export PAYPAL_MODE="sandbox"
export NODE_ENV=development
```

### Non-obvious caveats

- **API server dev command builds then starts**: `pnpm --filter @workspace/api-server run dev` runs esbuild first, then `node dist/index.mjs`. There is no hot-reload — restart after code changes.
- **Vite proxy required**: The frontend uses relative `/api` paths. The `artifacts/awdp-site/vite.config.mts` has a proxy configured to forward `/api` requests to `http://localhost:3000`.
- **Health endpoint path**: The API health check is at `/api/healthz` (not `/api/health`).
- **Schema push**: After DB setup, run `DATABASE_URL=... pnpm --filter @workspace/db run push` to create tables. The seed data is auto-populated on first API server start.
- **sharp native binaries**: `sharp` is in `onlyBuiltDependencies` in `pnpm-workspace.yaml`. If you see sharp errors, ensure `pnpm install` ran successfully.
- **Root typecheck**: `npx tsc --build --emitDeclarationOnly` passes for the shared libraries. Individual package typechecks (`api-server`, `awdp-site`) have pre-existing type errors that don't affect runtime builds.
- **No separate linter**: The project has no ESLint/Biome config. TypeScript checking is the primary static analysis tool.
- **Stripe/PayPal**: Placeholder keys work for dev (checkout routes will fail at actual payment processing but the app runs fine).
- **Admin login**: POST to `/api/admin/login` with `{ "password": "<ADMIN_PASSWORD>" }` to authenticate admin sessions.
