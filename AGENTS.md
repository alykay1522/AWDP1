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
# Optional — large admin JSON / long imports (defaults are usually fine)
# export API_JSON_BODY_LIMIT="32mb"
# export MAX_PRODUCT_IMPORT_ROWS="10000"
# export API_BULK_REQUEST_TIMEOUT_MS="600000"
```

### Vercel / production

Set at least: `DATABASE_URL`, `SESSION_SECRET`, `ADMIN_PASSWORD`, `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_MODE` (`live` in production), `CONTACT_FORWARD_EMAILS`, `EMAIL_APP_PASSWORD`, `CHECKOUT_PAYPAL_ONLY=true`, and point the frontend’s API base to your API (same-origin `/api` if using a combined deployment, or configure the site’s proxy / env so `/api` hits the API server).

**Product variants:** DB columns `variant_group_id`, `variant_label`, and JSON `attributes` on `products` link sibling SKUs; `GET /api/products/:sku/variants` and the product page handle groups when data is present.

**Admin CSV (two flows):**
- **Catalog upsert (SKUs, prices, stock):** Admin → Products → **Import CSV** parses client-side then `POST /api/admin/products/import` with `{ rows }`. Large files are sent in **400-row batches** from the UI. Re-importing the same SKU is an upsert (idempotent updates). Optional env: `MAX_PRODUCT_IMPORT_ROWS` (default `10000` per request), `API_JSON_BODY_LIMIT` (default `32mb` for `express.json`), `API_BULK_REQUEST_TIMEOUT_MS` (default `600000` HTTP server timeout for long imports).
- **CLI bulk import (same API as the UI):** With the API running, `ADMIN_PASSWORD` set, and a UTF-8 CSV whose headers match export columns (plus optional `cost` / dealer columns per server `normalizeRow`):  
  `pnpm --filter @workspace/api-server run bulk-product-import -- path/to/products.csv`  
  (or `node artifacts/api-server/scripts/bulk-product-import.mjs …`; optional `API_BASE`, `CHUNK_SIZE`).
- **Description-only matcher:** `POST /api/admin/csv-import?mode=preview|apply` (multipart `file`) — matches scraped titles to existing products and updates descriptions; not the same as catalog import.

**Export:** `GET /api/admin/products/export` (authenticated admin session).

**Resources / PDFs (Vercel):** Public `GET /api/resources` returns `{ resources }` from `pdf_resources` (active only). The storefront **Resources** page merges that JSON with static `PDF_RESOURCES` in `artifacts/awdp-site/src/pages/resources.tsx` (measurement guides, external catalog URLs). Self-hosted PDFs: add files under `artifacts/awdp-site/public/resources/` (tracked folder includes `.gitkeep`); they are served at **`/resources/<filename>.pdf`** on Vite and on Vercel with the static frontend. DB-backed rows can use full `https://` URLs or same-origin paths like `/resources/foo.pdf`.

**`awdp_automation.py` (repo root):** WooCommerce maintenance via `config_awdp.json` — fetches products, can emit `price_updates.csv`, cleanup lists, `products_export.json` (sync stub), etc. Those formats target **WooCommerce IDs**, not the AWDP admin import. To feed AWDP, export a catalog CSV from Woo (or your ETL) with columns compatible with `GET /api/admin/products/export` / `normalizeRow` (see `artifacts/api-server/src/routes/adminProducts.ts`), then import via admin or `bulk-product-import.mjs`.

### PostgreSQL setup (Cloud VM)

PostgreSQL 16 is not pre-installed on fresh Cloud VMs. Install and configure once:
```bash
sudo apt-get update -qq && sudo apt-get install -y -qq postgresql-16 postgresql-client-16
sudo pg_ctlcluster 16 main start
sudo -u postgres psql -c "CREATE USER awdp WITH PASSWORD 'awdp123';"
sudo -u postgres psql -c "CREATE DATABASE awdp OWNER awdp;"
```
After DB setup, push the schema: `DATABASE_URL="postgresql://awdp:awdp123@localhost:5432/awdp" pnpm --filter @workspace/db run push`

TypeScript (5.9) must be installed globally for typechecks: `npm install -g typescript@5.9`

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
