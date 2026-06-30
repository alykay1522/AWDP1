/**
 * SSR Vercel Function: api/render.mjs
 * Detects crawlers and serves SSR HTML with proper metadata
 * For browsers: serves the normal SPA bundle
 *
 * Deploy as: /api/render (or route specific paths here)
 * Examples:
 *   GET /api/render?path=/shop
 *   GET /api/render?path=/product/ABC-123
 *   GET /api/render?path=/guides/window-balance
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, "../.vercel/output/static");

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
 * Parse URL pathname to route
 */
function parsePath(pathname) {
  return (pathname || "/").replace(/\/$/, "") || "/";
}

/**
 * Fetch metadata from the backend API
 */
async function fetchMetadata(pathname) {
  const apiBase =
    process.env.VITE_API_BASE_URL ||
    process.env.API_SERVER_URL ||
    "http://localhost:3000/api";

  const route = parsePath(pathname);

  try {
    // Fetch catalog stats for shop page
    if (route === "/shop") {
      return {
        title: "Shop Window & Door Parts | 35,000+ Replacement Hardware",
        description:
          "Browse 35,000+ replacement window and door parts. Casement operators, sash balances, patio door rollers, locks, weatherstripping, and more. Fast shipping.",
        keywords:
          "window parts, door parts, replacement hardware, casement operators, window balances",
        canonicalPath: "/shop",
        image: "https://www.allwindowdoorparts.com/opengraph.jpg",
        imageAlt: "Shop All Window and Door Parts",
      };
    }

    // Categories
    if (route === "/categories") {
      return {
        title: "Browse by Category | Window Balances, Hardware, Locks, Weatherstripping",
        description:
          "Shop window and door parts by category. Window balances, operators, sash hardware, door hardware, weatherstripping, screen parts, and more.",
        keywords:
          "window balances, window hardware, door hardware, weatherstripping, sash locks",
        canonicalPath: "/categories",
        image: "https://www.allwindowdoorparts.com/opengraph.jpg",
        imageAlt: "Browse Window and Door Parts by Category",
      };
    }

    // Product detail
    if (route.startsWith("/product/")) {
      const sku = route.replace("/product/", "");
      try {
        const res = await fetch(`${apiBase}/products/${sku}`);
        if (res.ok) {
          const product = await res.json();
          return {
            title: `${product.name || sku} | All Window Door Parts`,
            description: (product.description || `${product.name || sku} replacement window and door hardware`)
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
      return {
        title: `Product ${sku} | All Window Door Parts`,
        description: `Find replacement window and door parts at All Window Door Parts.`,
        canonicalPath: `/product/${sku}`,
      };
    }

    // Guides
    if (route === "/guides") {
      return {
        title: "Expert Window & Door Repair Guides | Free How-To Articles",
        description:
          "Learn how to replace window balances, operators, weatherstripping, door rollers, and more. Free expert guides from All Window Door Parts.",
        keywords: "window repair, window balance, door repair, how-to guides",
        canonicalPath: "/guides",
        image: "https://www.allwindowdoorparts.com/opengraph.jpg",
        imageAlt: "Window & Door Repair Guides",
      };
    }

    // Individual guides
    if (route.startsWith("/guides/")) {
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
          title: "How to Replace Patio Door Rollers | Easy Step-by-Step Instructions",
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

      const slug = route.replace("/guides/", "");
      const guide = guides[slug];
      if (guide) {
        return {
          ...guide,
          canonicalPath: `/guides/${slug}`,
          image: "https://www.allwindowdoorparts.com/opengraph.jpg",
        };
      }
    }

    // About
    if (route === "/about") {
      return {
        title: "About All Window Door Parts | Veteran Owned, 40+ Years",
        description:
          "Veteran-owned window and door parts supplier with 40+ years of industry experience.",
        keywords: "veteran owned, window parts supplier, door hardware",
        canonicalPath: "/about",
        image: "https://www.allwindowdoorparts.com/opengraph.jpg",
        imageAlt: "All Window Door Parts — Veteran Owned",
      };
    }

    // Parts Identification
    if (route === "/parts-identification" || route === "/identify-balance") {
      return {
        title: "Free Parts Identification | All Window Door Parts",
        description:
          "Can't identify your part? Use our free Parts ID service. Send a photo or description, and our experts will identify your hardware.",
        keywords: "parts identification, identify parts, free",
        canonicalPath: "/parts-identification",
        image: "https://www.allwindowdoorparts.com/opengraph.jpg",
        imageAlt: "Free Parts Identification Service",
      };
    }

    // Resources
    if (route === "/resources") {
      return {
        title: "Window & Door Repair Resources | PDFs, Guides & Tools",
        description:
          "Access free resources including measurement guides, installation instructions, and PDF catalogs.",
        keywords: "resources, measurement guides, installation guides",
        canonicalPath: "/resources",
        image: "https://www.allwindowdoorparts.com/opengraph.jpg",
        imageAlt: "Resources",
      };
    }

    // Contact
    if (route === "/contact") {
      return {
        title: "Contact All Window Door Parts | Support & Questions",
        description:
          "Get in touch with All Window Door Parts. Call 785-533-0244 or use our contact form.",
        keywords: "contact, support, customer service",
        canonicalPath: "/contact",
        image: "https://www.allwindowdoorparts.com/opengraph.jpg",
        imageAlt: "Contact Us",
      };
    }

    // Home
    if (route === "/") {
      return {
        title: "All Window Door Parts — Window & Door Hardware",
        description:
          "Veteran-owned supplier with 40+ years experience. Shop 35,000+ window & door replacement parts.",
        keywords: "window parts, door parts, replacement hardware",
        canonicalPath: "/",
        image: "https://www.allwindowdoorparts.com/opengraph.jpg",
        imageAlt: "All Window Door Parts",
      };
    }
  } catch (error) {
    console.error("Error fetching metadata:", error);
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
  tags.push(
    `<link rel="canonical" href="${escapeHtml(canonicalUrl)}" />`
  );

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
 * Read and parse index.html template
 */
function readTemplate() {
  try {
    const templatePath = path.join(publicDir, "index.html");
    return fs.readFileSync(templatePath, "utf-8");
  } catch (error) {
    console.error("Error reading template:", error);
    return null;
  }
}

/**
 * Inject metadata into HTML template for crawlers
 */
function injectMetadataIntoHtml(html, metadata) {
  if (!html || !metadata) return html;

  const metaTags = generateMetaTags(metadata);
  const title = metadata.title;

  // Replace title tag
  html = html.replace(
    /<title>.*?<\/title>/i,
    `<title>${escapeHtml(title)}</title>`
  );

  // Inject meta tags before </head>
  html = html.replace(
    "</head>",
    `\n  ${metaTags}\n</head>`
  );

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
  const pathname = req.query.path || "/";
  const isBot = isBotUserAgent(userAgent);

  console.log(`[SSR] ${isBot ? "BOT" : "USER"} - ${pathname} - UA: ${userAgent.substring(0, 50)}`);

  // Only SSR for specific public routes
  const publicRoutes = [
    "/",
    "/shop",
    "/categories",
    "/product/",
    "/guides",
    "/about",
    "/parts-identification",
    "/resources",
    "/contact",
    "/identify-balance",
  ];

  const shouldSSR =
    isBot &&
    publicRoutes.some((route) => pathname === route || pathname.startsWith(route));

  if (!shouldSSR) {
    // Serve normal SPA or return 404 for bots on non-public routes
    const template = readTemplate();
    if (template) {
      return res
        .status(200)
        .setHeader("Content-Type", "text/html; charset=utf-8")
        .send(template);
    }
    return res.status(404).json({ error: "Not found" });
  }

  // Fetch metadata for the route
  const metadata = await fetchMetadata(pathname);

  if (!metadata) {
    // Route not found
    const template = readTemplate();
    if (template) {
      return res
        .status(404)
        .setHeader("Content-Type", "text/html; charset=utf-8")
        .send(template);
    }
    return res.status(404).json({ error: "Not found" });
  }

  // Read template and inject metadata
  const template = readTemplate();
  if (!template) {
    return res.status(500).json({ error: "Template not found" });
  }

  const html = injectMetadataIntoHtml(template, metadata);

  // Return SSR HTML to crawler
  res
    .status(200)
    .setHeader("Content-Type", "text/html; charset=utf-8")
    .setHeader("Cache-Control", "public, s-maxage=3600, stale-while-revalidate=86400")
    .send(html);
}
