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
# Admin login password — set only via env (never commit production values)
export ADMIN_PASSWORD="your-local-admin-password"
export PAYPAL_CLIENT_ID="paypal_test_placeholder"
export PAYPAL_CLIENT_SECRET="paypal_test_placeholder"
export PAYPAL_MODE="sandbox"
export NODE_ENV=development
```

Optional / feature-specific:

```bash
# Comma-separated staff inboxes: contact form, parts-ID forwards, order owner alerts (required for outbound mail to staff)
export CONTACT_FORWARD_EMAILS="ops@example.com,orders@example.com"
# SMTP app password for info@allwindowdoorparts.com (required to actually send mail)
export EMAIL_APP_PASSWORD="..."
# PayPal-only: disables Stripe checkout session, fulfill route, and Stripe webhook registration.
# If unset: PayPal-only when STRIPE_SECRET_KEY is missing or contains "placeholder"; set to false to use Stripe with a real key.
export CHECKOUT_PAYPAL_ONLY="true"
# Only needed when CHECKOUT_PAYPAL_ONLY is false and you use card checkout
export STRIPE_SECRET_KEY="sk_test_..."
```

### Vercel / production

Set at least: `DATABASE_URL`, `SESSION_SECRET`, `ADMIN_PASSWORD`, `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_MODE` (`live` in production), `CONTACT_FORWARD_EMAILS`, `EMAIL_APP_PASSWORD`, `CHECKOUT_PAYPAL_ONLY=true`, and point the frontend’s API base to your API (same-origin `/api` if using a combined deployment, or configure the site’s proxy / env so `/api` hits the API server).

**Product variants:** DB columns `variant_group_id`, `variant_label`, and JSON `attributes` on `products` link sibling SKUs; `GET /api/products/:sku/variants` and the product page handle groups when data is present.

**Admin CSV:** `POST /api/admin/csv-import` (multipart file). **Export:** `GET /api/admin/products/export` (authenticated admin session).

### Non-obvious caveats

- **API server dev command builds then starts**: `pnpm --filter @workspace/api-server run dev` runs esbuild first, then `node dist/index.mjs`. There is no hot-reload — restart after code changes.
- **Vite proxy required**: The frontend uses relative `/api` paths. The `artifacts/awdp-site/vite.config.mts` has a proxy configured to forward `/api` requests to `http://localhost:3000`.
- **Health endpoint path**: The API health check is at `/api/healthz` (not `/api/health`).
- **Schema push**: After DB setup, run `DATABASE_URL=... pnpm --filter @workspace/db run push` to create tables. The seed data is auto-populated on first API server start.
- **sharp native binaries**: `sharp` is in `onlyBuiltDependencies` in `pnpm-workspace.yaml`. If you see sharp errors, ensure `pnpm install` ran successfully.
- **Root typecheck**: `npx tsc --build --emitDeclarationOnly` passes for the shared libraries. Individual package typechecks (`api-server`, `awdp-site`) have pre-existing type errors that don't affect runtime builds.
- **No separate linter**: The project has no ESLint/Biome config. TypeScript checking is the primary static analysis tool.
- **Checkout**: With `CHECKOUT_PAYPAL_ONLY` (or no usable Stripe key), only PayPal checkout is shown; Stripe routes return 503.
- **Admin login**: POST to `/api/admin/login` with `{ "password": "<ADMIN_PASSWORD>" }` to authenticate admin sessions.
