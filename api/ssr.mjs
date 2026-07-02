export const config = {
  api: {
    bodyParser: false,
  },
};

/**
 * Vercel rewrite target for pre-rendered SEO pages (see vercel.json rewrites).
 * Delegates to the existing SSR metadata/body injector so every crawler and
 * visitor hitting a known static/guide/product route gets a real per-page
 * <title>/description/OG/schema instead of the generic SPA shell — and so
 * a truly unknown /product/:sku gets an honest 404 instead of 200.
 */
export { default } from "../artifacts/awdp-site/api/ssr.mjs";
