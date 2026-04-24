# Threat Model

## Project Overview

AWDP is a pnpm monorepo for an e-commerce storefront and admin back office for window and door parts. The production application consists of a public React + Vite site in `artifacts/awdp-site` and an Express 5 API in `artifacts/api-server`, backed by PostgreSQL via Drizzle. Public users can browse products, submit contact and parts-identification requests, and complete checkout via Stripe or PayPal. Administrators manage catalog, orders, pricing, images, and site settings through password-protected `/api/admin/*` routes.

Production-scope assumptions for this repo:
- `artifacts/api-server` and `artifacts/awdp-site` are production surfaces.
- `lib/db` is shared production code.
- `artifacts/mockup-sandbox` is dev-only and should be ignored unless a production path reaches it.
- `.agents/`, most attached assets, and local tooling are not production-reachable unless explicitly mounted or invoked by production code.
- In production, Replit terminates TLS for browser-to-server traffic.

## Assets

- **Admin session integrity** — the admin surface can change product data, pricing, orders, categories, uploaded images, and settings. Compromise gives effective control over the storefront and business operations.
- **Order and payment integrity** — checkout totals, purchased SKUs, shipping details, order status, and payment-provider references must accurately reflect what the customer bought and paid for.
- **Customer data** — orders, contact submissions, and parts-identification requests contain names, email addresses, phone numbers, shipping addresses, free-form descriptions, and sometimes uploaded photos.
- **Application secrets** — session secret, admin password, database credentials, Stripe secret key, PayPal secret, object-storage credentials, and SMTP credentials all enable privileged access if leaked or misused.
- **Catalog and pricing data** — product records, inventory state, images, cost tracking, and markup data directly affect revenue and business decisions.

## Trust Boundaries

- **Browser to API** — all public and admin requests cross from an untrusted client into the Express API. The server must treat cart contents, route params, query strings, and form bodies as attacker-controlled.
- **API to PostgreSQL** — the API has broad access to orders, admin sessions, customer submissions, and catalog data. Query safety and result scoping are critical.
- **API to payment providers** — the backend creates Stripe and PayPal payment objects using high-privilege secrets. The app must verify payment state and bind provider events to the correct local order.
- **API to SMTP and object storage** — the backend sends customer/order emails and reads/writes product images in remote services. These integrations carry customer data and business-sensitive content.
- **Public to admin boundary** — `/api/admin/*` is the main privilege boundary. All admin operations must require server-side authentication and unforgeable session state.

## Scan Anchors

- **Production entry points:** `artifacts/api-server/src/index.ts`, `artifacts/api-server/src/app.ts`, `artifacts/awdp-site/src/main.tsx`.
- **Highest-risk code areas:** `artifacts/api-server/src/routes/checkout.ts`, `artifacts/api-server/src/routes/paypal.ts`, `artifacts/api-server/src/routes/adminAuth.ts`, `artifacts/api-server/src/middleware/requireAdmin.ts`, `artifacts/api-server/src/routes/admin*.ts`, `artifacts/api-server/src/lib/email.ts`, `artifacts/api-server/src/emailNotifier.ts`, `lib/db/src/index.ts`.
- **Public surfaces:** `/api/products*`, `/api/categories`, `/api/contact`, `/api/parts-identification`, `/api/checkout/*`, `/api/paypal/*`, `/api/stripe/webhook`, sitemap.
- **Authenticated/admin surfaces:** `/api/admin/*` except the intentionally public image-serve path under `/api/admin/images/serve/*`.
- **Usually dev-only / lower priority:** `artifacts/mockup-sandbox`, `.agents/`, local scripts, and template object-storage routes unless they are mounted by `app.ts`.

## Threat Categories

### Spoofing

The admin area relies on a session cookie and a boolean `adminAuthenticated` flag. The application must ensure admin sessions can only be created after successful authentication, cannot be forged through weak or fallback secrets, and are not exposed to cross-boundary abuse. Payment-provider callbacks and post-payment flows must also be tied to authentic provider state rather than attacker-supplied identifiers.

### Tampering

Checkout, PayPal order creation, and any pricing-sensitive workflow must derive authoritative price, stock, and product identity from server-side records, not from client-submitted cart contents. Admin endpoints must validate mutations to catalog, pricing, and order status so attackers cannot alter business data through malformed or unauthorized requests.

### Information Disclosure

Order records, contact submissions, parts-identification requests, uploaded images, and pricing-monitor data contain customer or business-sensitive information. The API must scope access to these records appropriately, avoid exposing private object-storage contents, and keep detailed internal errors or secrets out of logs and responses.

### Denial of Service

Public submission endpoints and checkout-related routes accept attacker-controlled bodies and can trigger database writes, payment-provider calls, email sends, or large uploads. These paths must have practical size limits, validation, and abuse controls so a public user cannot exhaust API, storage, or third-party service capacity.

### Elevation of Privilege

The core privilege boundary is between public users and admin-only routes. Every admin route must enforce server-side authentication consistently, and any session, object-storage, or route exceptions must be tightly constrained so public traffic cannot escalate into administrative actions or privileged data access.

### Cryptographic / Transport Guarantees

The application depends on external TLS connections for PostgreSQL and SMTP. Production code must verify peer certificates and must fail closed when required secrets such as `SESSION_SECRET` are missing, rather than silently using insecure defaults that weaken authentication or expose customer data to interception.