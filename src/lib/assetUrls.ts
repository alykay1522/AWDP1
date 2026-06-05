/**
 * Static asset URL constants.
 *
 * All paths resolve to /public/assets/* and are served by the web server as
 * plain static files. They are intentionally NOT imported through Vite's
 * module graph — if an image file is missing it logs a 404 in the browser,
 * but it can never crash the build or produce a module-not-found error.
 */

// Hero section background (homepage)
export const heroBg     = "/assets/hero_hardware_bg.png";
export const heroBgWebp = "/assets/hero_hardware_bg.webp";

// Parts-ID CTA section background (homepage)
export const ctaBg      = "/assets/cta_hardware_bg.png";
export const ctaBgWebp  = "/assets/cta_hardware_bg.webp";

// Header / footer / mobile-nav logos
export const logo        = "/assets/logo_banner_trimmed.png";   // mobile nav + footer
export const logoBanner  = "/assets/logo-banner.png";           // full-width banner

// PayPal acceptance badge (footer)
export const paypalImg   = "/assets/paypal_badge.png";
