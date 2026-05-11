#!/usr/bin/env node
console.error(
  [
    "This script is obsolete.",
    "",
    "AWDP now serves the Express backend from same-origin Vercel serverless functions.",
    "Do not set API_SERVER_ORIGIN, EXPRESS_API_ORIGIN, or VITE_API_BASE_URL for the production site.",
    "",
    "In Vercel Dashboard, remove those old API-origin variables and set the required backend env instead:",
    "  DATABASE_URL=<hosted Postgres connection string, not localhost>",
    "  SESSION_SECRET=<strong secret>",
    "  ADMIN_PASSWORD=<admin password>",
    "  PAYPAL_CLIENT_ID=<production client id>",
    "  PAYPAL_CLIENT_SECRET=<production secret>",
    "  PAYPAL_MODE=live",
    "  CHECKOUT_PAYPAL_ONLY=true",
    "",
    "Then redeploy https://allwindowdoorparts.com.",
  ].join("\n"),
);
process.exit(1);
