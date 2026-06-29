/**
 * Central asset URL registry.
 *
 * Images that live in /public are served as static paths and never go through
 * Vite's module graph, so a missing file does NOT crash the build.
 *
 * Original local assets were never committed to git; this module returns the
 * public path so the build succeeds while the owner can drop real images into
 * /public/assets/ at any time to activate them.
 */

export const heroBg     = "/assets/hero_hardware_bg.png";
export const heroBgWebp = "/assets/hero_hardware_bg.webp";
export const ctaBg      = "/assets/cta_hardware_bg.png";
export const ctaBgWebp  = "/assets/cta_hardware_bg.webp";

/** Full-width header banner artwork */
export const headerBg    = "/assets/header_bg.jpg";

/** Logo used in footer / mobile nav */
export const logo        = "/assets/logo-banner.png";
/** Wide trimmed banner logo used in mobile nav link */
export const logoBanner  = "/assets/logo_banner_trimmed.png";
/** PayPal acceptance badge */
export const paypalImg   = "/assets/paypal_badge.png";
