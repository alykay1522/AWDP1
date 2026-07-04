export const config = {
  api: {
    bodyParser: false,
  },
};

/**
 * Vercel rewrite target for crawler-visible storefront pages.
 * The renderer injects route-specific metadata and route-specific HTML content,
 * canonicalizes encoded product paths, and returns real 404 responses.
 */
export { default } from "../artifacts/awdp-site/api/ssr-v2.mjs";
