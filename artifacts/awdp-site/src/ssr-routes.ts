/**
 * SSR Route Handlers
 * Maps request paths to metadata fetchers and components
 */

import type { PageMetadata } from "./ssr-metadata.js";
import {
  getShopMetadata,
  getCategoriesMetadata,
  getProductMetadata,
  getGuideHubMetadata,
  getGuideMetadata,
  getAboutMetadata,
  getPartsIdMetadata,
  getResourcesMetadata,
  getContactMetadata,
  getHomeMetadata,
} from "./ssr-metadata.js";

export interface RouteHandler {
  metadata: () => Promise<PageMetadata>;
  componentKey?: string;
}

/**
 * Parse URL path and query params
 */
export function parsePath(pathname: string): {
  route: string;
  params: Record<string, string>;
} {
  const parts = pathname.split("/").filter(Boolean);
  const params: Record<string, string> = {};

  // Normalize leading/trailing slashes
  const withLeadingSlash = pathname.startsWith("/") ? pathname : `/${pathname}`;
  const normalized = withLeadingSlash.replace(/\/$/, "") || "/";

  return {
    route: normalized,
    params,
  };
}

/**
 * Route matcher: given a pathname, return the appropriate metadata fetcher
 */
export async function getRouteMetadata(pathname: string): Promise<PageMetadata | null> {
  const { route } = parsePath(pathname);

  // Home
  if (route === "/") {
    return getHomeMetadata();
  }

  // Shop
  if (route === "/shop") {
    return getShopMetadata();
  }

  // Categories
  if (route === "/categories") {
    return getCategoriesMetadata();
  }

  // Product detail: /product/:sku
  if (route.startsWith("/product/")) {
    const sku = route.replace("/product/", "");
    if (sku && sku.length > 0) {
      return getProductMetadata(sku);
    }
  }

  // Guides hub
  if (route === "/guides") {
    return getGuideHubMetadata();
  }

  // Individual guide: /guides/:slug
  if (route.startsWith("/guides/")) {
    const slug = route.replace("/guides/", "");
    if (slug && slug.length > 0) {
      return getGuideMetadata(slug);
    }
  }

  // About
  if (route === "/about") {
    return getAboutMetadata();
  }

  // Parts Identification
  if (route === "/parts-identification") {
    return getPartsIdMetadata();
  }

  // Resources
  if (route === "/resources") {
    return getResourcesMetadata();
  }

  // Contact
  if (route === "/contact") {
    return getContactMetadata();
  }

  // Parts Identify (alternate path)
  if (route === "/identify-balance") {
    return getPartsIdMetadata();
  }

  // All other paths return null (let browser handle it)
  return null;
}

/**
 * Check if a route should be SSR'd for crawlers
 * Returns true for public content routes, false for admin/checkout/etc
 */
export function shouldSSRRoute(pathname: string): boolean {
  const { route } = parsePath(pathname);

  // Admin routes should NOT be SSR'd
  if (route.startsWith("/admin")) {
    return false;
  }

  // Checkout/payment flows should NOT be SSR'd
  if (route.startsWith("/checkout")) {
    return false;
  }

  // Cart should NOT be SSR'd
  if (route === "/cart") {
    return false;
  }

  // Public pages that should be SSR'd
  const ssrRoutes = [
    "/",
    "/shop",
    "/categories",
    "/product",
    "/guides",
    "/about",
    "/parts-identification",
    "/resources",
    "/contact",
    "/identify-balance",
  ];

  return ssrRoutes.some((candidate) => {
    if (candidate === "/") return route === "/";
    return route === candidate || route.startsWith(`${candidate}/`);
  });
}

/**
 * Check if a User-Agent is a bot/crawler
 */
export function isBotUserAgent(userAgent: string): boolean {
  if (!userAgent) return false;

  const botPatterns = [
    /googlebot/i,
    /bingbot/i,
    /slurp/i,
    /duckduckbot/i,
    /baiduspider/i,
    /yandexbot/i,
    /facebookexternalhit/i,
    /twitterbot/i,
    /linkedinbot/i,
    /whatsapp/i,
    /pinterestbot/i,
    /applebot/i,
    /msnbot/i,
    /rogerbot/i,
    /curl/i,
    /wget/i,
    /ahrefs/i,
    /semrush/i,
    /screaming.frog/i,
    /mediapartners-google/i,
  ];

  return botPatterns.some((pattern) => pattern.test(userAgent));
}
