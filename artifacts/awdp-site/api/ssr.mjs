/**
 * SSR Vercel Function: api/ssr.mjs
 * Catch-all handler that detects crawlers and serves SSR HTML with proper metadata
 * For browsers: serves the normal SPA bundle (index.html)
 *
 * Deployed as a catch-all route that intercepts all non-API, non-asset requests
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// In production (Vercel), static files are in .vercel/output/static
// In development, they're in dist/public
const publicDir = path.join(__dirname, "../dist/public");

/**
 * Check if User-Agent is a bot/crawler
 */
function isBotUserAgent(userAgent) {
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

/**
 * Escape HTML special characters
 */
function escapeHtml(text) {
  const map = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  };
  return String(text).replace(/[&<>"']/g, (char) => map[char] || char);
}

/**
 * Normalize pathname
 */
function normalizePath(pathname) {
  const raw = String(pathname || "/");
  const withLeadingSlash = raw.startsWith("/") ? raw : `/${raw}`;
  return withLeadingSlash.replace(/\/$/, "") || "/";
}

/**
 * Fetch metadata from the backend API
 */
function resolveApiBase(req) {
  const configured =
    process.env.VITE_API_BASE_URL ||
    process.env.API_SERVER_URL ||
    process.env.EXPRESS_API_ORIGIN;
  if (configured) return configured.replace(/\/$/, "");

  const forwardedHost = String(req?.headers?.["x-forwarded-host"] || "")
    .split(",", 1)[0]
    .trim();
  const host = forwardedHost || String(req?.headers?.host || "").trim();
  if (host && /^[A-Za-z0-9.-]+(?::\d{1,5})?$/.test(host)) {
    const forwardedProto = String(req?.headers?.["x-forwarded-proto"] || "https")
      .split(",", 1)[0]
      .trim();
    const protocol = forwardedProto === "http" ? "http" : "https";
    return `${protocol}://${host}/api`;
  }

  return process.env.NODE_ENV === "production"
    ? "https://www.allwindowdoorparts.com/api"
    : "http://localhost:3000/api";
}

async function fetchMetadata(pathname, apiBase = resolveApiBase(), options = {}) {
  const fetchImpl = options.fetchImpl || fetch;
  const route = normalizePath(pathname);

  try {
    // Product detail: /product/:sku
    if (route.startsWith("/product/")) {
      const sku = route.replace("/product/", "");
      if (sku && sku.length > 0) {
        try {
          const res = await fetchImpl(`${apiBase}/products/${encodeURIComponent(sku)}`, {
            method: "GET",
            headers: { "Accept": "application/json" },
            signal: AbortSignal.timeout(5000),
          });
          if (res.ok) {
            const product = await res.json();
            return {
              title: `${product.name || sku} | All Window Door Parts`,
              description: (product.description || `${product.name || sku} - window and door hardware`)
                .substring(0, 160)
                .trim(),
              keywords: `${product.name || ""}, ${product.category || ""}, window parts`,
              canonicalPath: `/product/${sku}`,
              image: product.image_url || "https://www.allwindowdoorparts.com/opengraph.jpg",
              imageAlt: product.name || sku,
            };
          }
        } catch (e) {
          console.error(`Error fetching product ${sku}:`, e);
        }
        // Fallback for product not found
        return {
          title: `Product ${sku} | All Window Door Parts`,
          description: "Find replacement window and door parts at All Window Door Parts.",
          canonicalPath: `/product/${sku}`,
        };
      }
    }
  } catch (error) {
    console.error("Error in fetchMetadata:", error);
  }

  // Return metadata for non-product routes based on path
  const metadataMap = {
    "/": {
      title: "All Window Door Parts — Window & Door Hardware",
      description:
        "Veteran-owned supplier with 40+ years experience. Shop 35,000+ window & door replacement parts: casement operators, sash balances, patio door rollers, locks, weatherstripping. Free Parts ID.",
      keywords: "window parts, door parts, replacement hardware, veteran owned",
      canonicalPath: "/",
      image: "https://www.allwindowdoorparts.com/opengraph.jpg",
      imageAlt: "All Window Door Parts",
    },
    "/shop": {
      title: "Shop Window & Door Parts | 35,000+ Replacement Hardware",
      description:
        "Browse 35,000+ replacement window and door parts. Casement operators, sash balances, patio door rollers, locks, weatherstripping, and more. Fast shipping.",
      keywords: "window parts, door parts, replacement hardware, casement operators",
      canonicalPath: "/shop",
      image: "https://www.allwindowdoorparts.com/opengraph.jpg",
      imageAlt: "Shop All Window and Door Parts",
    },
    "/categories": {
      title: "Browse by Category | Window Balances, Hardware, Locks",
      description:
        "Shop window and door parts by category. Window balances, operators, sash hardware, door hardware, weatherstripping, and more.",
      keywords: "window balances, window hardware, door hardware, weatherstripping",
      canonicalPath: "/categories",
      image: "https://www.allwindowdoorparts.com/opengraph.jpg",
      imageAlt: "Browse Window and Door Parts by Category",
    },
    "/guides": {
      title: "Expert Window & Door Repair Guides | Free How-To Articles",
      description:
        "Learn how to replace window balances, operators, weatherstripping, door rollers, and more. Free expert guides.",
      keywords: "window repair, door repair, how-to guides, replacement guides",
      canonicalPath: "/guides",
      image: "https://www.allwindowdoorparts.com/opengraph.jpg",
      imageAlt: "Window & Door Repair Guides",
    },
    "/about": {
      title: "About All Window Door Parts | Veteran Owned, 40+ Years",
      description:
        "Veteran-owned window and door parts supplier with 40+ years of industry experience.",
      keywords: "veteran owned, window parts supplier, door hardware",
      canonicalPath: "/about",
      image: "https://www.allwindowdoorparts.com/opengraph.jpg",
      imageAlt: "All Window Door Parts",
    },
    "/parts-identification": {
      title: "Free Parts Identification | All Window Door Parts",
      description:
        "Can't identify your part? Use our free Parts ID service. Send a photo or description, and our experts will identify your window and door hardware.",
      keywords: "parts identification, identify parts, free",
      canonicalPath: "/parts-identification",
      image: "https://www.allwindowdoorparts.com/opengraph.jpg",
      imageAlt: "Free Parts Identification Service",
    },
    "/identify-balance": {
      title: "Free Parts Identification | All Window Door Parts",
      description:
        "Can't identify your part? Use our free Parts ID service. Send a photo or description, and our experts will identify your hardware.",
      keywords: "parts identification, identify parts, free",
      canonicalPath: "/identify-balance",
      image: "https://www.allwindowdoorparts.com/opengraph.jpg",
      imageAlt: "Free Parts Identification Service",
    },
    "/resources": {
      title: "Window & Door Repair Resources | PDFs, Guides & Tools",
      description:
        "Access free resources including measurement guides, installation instructions, and PDF catalogs.",
      keywords: "resources, measurement guides, installation guides",
      canonicalPath: "/resources",
      image: "https://www.allwindowdoorparts.com/opengraph.jpg",
      imageAlt: "Resources",
    },
    "/contact": {
      title: "Contact All Window Door Parts | Support & Questions",
      description:
        "Get in touch with All Window Door Parts. Call 785-533-0244 or use our contact form.",
      keywords: "contact, support, customer service",
      canonicalPath: "/contact",
      image: "https://www.allwindowdoorparts.com/opengraph.jpg",
      imageAlt: "Contact Us",
    },
  };

  // Check for exact match
  if (metadataMap[route]) {
    return metadataMap[route];
  }

  // Check for guide paths /guides/:slug
  if (route.startsWith("/guides/")) {
    const slug = route.replace("/guides/", "");
    const guides = {
      "window-balance": {
        title: "How to Replace a Window Balance | Step-by-Step Guide",
        description: "Learn how to identify and replace window balance hardware.",
      },
      "window-operator": {
        title: "How to Replace a Casement Window Operator | Expert Guide",
        description: "Replace your casement window operator.",
      },
      "patio-door-roller": {
        title: "How to Replace Patio Door Rollers | Easy Step-by-Step",
        description: "Repair your sliding patio door.",
      },
      weatherstripping: {
        title: "How to Replace Weatherstripping | Window & Door Seals",
        description: "Stop drafts and improve energy efficiency.",
      },
      "door-lock": {
        title: "How to Replace a Window or Door Lock",
        description: "Replace broken window and door locks.",
      },
      "glazing-bead": {
        title: "How to Replace Glazing Beads | Glass Setting Guide",
        description: "Learn how to remove and install glazing beads.",
      },
    };
    if (guides[slug]) {
      return {
        ...guides[slug],
        canonicalPath: `/guides/${slug}`,
        image: "https://www.allwindowdoorparts.com/opengraph.jpg",
      };
    }
  }

  return null;
}

/**
 * Generate meta tags HTML from metadata object
 */
function generateMetaTags(metadata) {
  if (!metadata) return "";

  const tags = [];
  const baseUrl = "https://www.allwindowdoorparts.com";
  const canonicalUrl = baseUrl + metadata.canonicalPath;

  // Canonical
  tags.push(`<link rel="canonical" href="${escapeHtml(canonicalUrl)}" />`);

  // Primary meta
  if (metadata.description) {
    tags.push(
      `<meta name="description" content="${escapeHtml(metadata.description)}" />`
    );
  }
  if (metadata.keywords) {
    tags.push(
      `<meta name="keywords" content="${escapeHtml(metadata.keywords)}" />`
    );
  }

  // Robots
  tags.push(
    `<meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1" />`
  );

  // Open Graph
  const ogTitle = metadata.title;
  const ogDescription = metadata.description || "";
  const ogImage = metadata.image || baseUrl + "/opengraph.jpg";

  tags.push(`<meta property="og:type" content="website" />`);
  tags.push(`<meta property="og:site_name" content="All Window Door Parts" />`);
  tags.push(`<meta property="og:title" content="${escapeHtml(ogTitle)}" />`);
  tags.push(
    `<meta property="og:description" content="${escapeHtml(ogDescription)}" />`
  );
  tags.push(`<meta property="og:url" content="${escapeHtml(canonicalUrl)}" />`);
  tags.push(`<meta property="og:image" content="${escapeHtml(ogImage)}" />`);
  tags.push(`<meta property="og:image:width" content="1200" />`);
  tags.push(`<meta property="og:image:height" content="630" />`);
  tags.push(
    `<meta property="og:image:alt" content="${escapeHtml(metadata.imageAlt || ogTitle)}" />`
  );
  tags.push(`<meta property="og:locale" content="en_US" />`);

  // Twitter Card
  tags.push(`<meta name="twitter:card" content="summary_large_image" />`);
  tags.push(`<meta name="twitter:title" content="${escapeHtml(ogTitle)}" />`);
  tags.push(
    `<meta name="twitter:description" content="${escapeHtml(ogDescription)}" />`
  );
  tags.push(`<meta name="twitter:image" content="${escapeHtml(ogImage)}" />`);

  return tags.join("\n  ");
}

/**
 * Read index.html template
 */
function readTemplate(templatePath = path.join(publicDir, "index.html")) {
  try {
    const content = fs.readFileSync(templatePath, "utf-8");
    return content;
  } catch (error) {
    console.error("Error reading template:", error);
    return null;
  }
}

/**
 * Inject metadata into HTML template
 */
function injectMetadataIntoHtml(html, metadata) {
  if (!html || !metadata) return html;

  const metaTags = generateMetaTags(metadata);
  const title = metadata.title;

  // Replace title tag
  html = html.replace(/<title>.*?<\/title>/i, `<title>${escapeHtml(title)}</title>`);

  // Inject meta tags before </head>
  html = html.replace("</head>", `\n  ${metaTags}\n</head>`);

  return html;
}

/**
 * Main handler: Vercel Function
 */
export default async function handler(req, res) {
  // Enable CORS for local development
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const userAgent = req.headers["user-agent"] || "";
  const pathname = normalizePath(req.query.path || "/");
  const isBot = isBotUserAgent(userAgent);

  console.log(
    `[SSR] ${isBot ? "BOT" : "USER"} - ${pathname} - UA: ${userAgent.substring(0, 60)}`
  );

  // List of public routes that should be SSR'd for crawlers
  const publicRoutes = [
    "/",
    "/shop",
    "/categories",
    "/product/",
    "/guides",
    "/about",
    "/parts-identification",
    "/identify-balance",
    "/resources",
    "/contact",
  ];

  const shouldSSR = isBot && publicRoutes.some((candidate) => {
    const route = normalizePath(candidate);
    if (route === "/") return pathname === "/";
    if (candidate.endsWith("/")) return pathname.startsWith(`${route}/`);
    return pathname === route || pathname.startsWith(`${route}/`);
  });

  const template = readTemplate();
  if (!template) {
    console.error("Template not found");
    return res.status(500).json({ error: "Template not found" });
  }

  if (!shouldSSR) {
    // Serve normal SPA (index.html) for browsers
    return res
      .status(200)
      .setHeader("Content-Type", "text/html; charset=utf-8")
      .send(template);
  }

  // Fetch metadata for the route (bot only)
  const metadata = await fetchMetadata(pathname, resolveApiBase(req));

  if (!metadata) {
    // Route not found or not SSR eligible, serve SPA
    console.log(`[SSR] No metadata for ${pathname}, serving SPA`);
    return res
      .status(200)
      .setHeader("Content-Type", "text/html; charset=utf-8")
      .send(template);
  }

  // Inject metadata into template for crawler
  const html = injectMetadataIntoHtml(template, metadata);

  // Return SSR HTML to crawler
  return res
    .status(200)
    .setHeader("Content-Type", "text/html; charset=utf-8")
    .setHeader(
      "Cache-Control",
      "public, s-maxage=3600, stale-while-revalidate=86400"
    )
    .send(html);
}

export { fetchMetadata, injectMetadataIntoHtml, isBotUserAgent, normalizePath, readTemplate, resolveApiBase };
