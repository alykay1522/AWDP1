import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE_URL = (process.env.PUBLIC_SITE_URL || "https://www.allwindowdoorparts.com").replace(/\/+$/, "");
const DEFAULT_IMAGE = `${BASE_URL}/opengraph.jpg`;

const templateCandidates = [
  path.join(__dirname, "../dist/public/index.html"),
  path.join(process.cwd(), "dist/public/index.html"),
  path.join(process.cwd(), "artifacts/awdp-site/dist/public/index.html"),
];

const STATIC_PAGES = {
  "/": {
    title: "Replacement Window & Door Parts | All Window Door Parts",
    description: "Veteran-owned supplier with 40+ years of experience. Shop 4,000+ in-stock replacement window and door parts. Free Parts ID and expert help.",
    heading: "Replacement Window & Door Parts",
    intro: "Find current, obsolete, and hard-to-find replacement hardware for windows and doors. Our experts can identify an unknown part from photos at no charge.",
    links: [["Shop Window & Door Parts", "/shop"], ["Free Parts Identification", "/parts-identification"], ["Browse Repair Guides", "/guides"]],
  },
  "/shop": {
    title: "Shop Window & Door Replacement Parts | All Window Door Parts",
    description: "Browse 4,000+ in-stock window and door replacement parts, including casement operators, sash balances, patio door rollers, locks, weatherstripping, and screen hardware.",
    heading: "Shop Replacement Window & Door Parts",
    intro: "Search by SKU, brand, category, or part description. Product listings include measurements, compatibility details, stock status, and available variants when applicable.",
    links: [["Browse by Category", "/categories"], ["Free Parts Identification", "/parts-identification"], ["Window & Door Repair Guides", "/guides"]],
    schemaType: "CollectionPage",
  },
  "/categories": {
    title: "Browse Window & Door Parts by Category | All Window Door Parts",
    description: "Shop window balances, window operators, sash hardware, door hardware, weatherstripping, glazing supplies, screen parts, and specialty replacement hardware.",
    heading: "Browse Parts by Category",
    intro: "Choose the hardware category that matches your repair. You can also search by brand, SKU, dimensions, or the problem you are trying to fix.",
    links: [["Window Balances", "/shop?category=Window+Balances"], ["Window Hardware", "/shop?category=Window+Hardware"], ["Door Hardware", "/shop?category=Door+Hardware"], ["Weatherstrip & Glazing", "/shop?category=Window+Glazing+and+Weatherstrip"]],
    schemaType: "CollectionPage",
  },
  "/parts-identification": {
    title: "Free Window & Door Parts Identification | All Window Door Parts",
    description: "Upload photos and measurements for free expert identification of window and door replacement parts, including obsolete and discontinued hardware.",
    heading: "Free Parts Identification",
    intro: "Send clear photos and measurements of the part you need. Our experienced team will identify it and direct you to the correct replacement whenever possible.",
    links: [["Start Free Parts ID", "/parts-identification"], ["Browse All Parts", "/shop"], ["Identification Guides", "/guides"]],
    schemaType: "Service",
  },
  "/identify-balance": {
    title: "Identify Your Window Balance | Free Balance Identification",
    description: "Use the guided window-balance identification tool to match channel, spiral, and constant-force balances by type, length, stamp, and terminal style.",
    heading: "Identify Your Window Balance",
    intro: "Follow the guided steps to determine the balance type and measurements needed to order a compatible replacement.",
    links: [["Shop Window Balances", "/shop?category=Window+Balances"], ["Window Balance Guide", "/guides/window-balance"], ["Free Expert Parts ID", "/parts-identification"]],
    schemaType: "HowTo",
  },
  "/guides": {
    title: "Window & Door Repair Guides | All Window Door Parts",
    description: "Free expert guides for identifying, measuring, and replacing window balances, operators, patio door rollers, locks, weatherstripping, and glazing bead.",
    heading: "Window & Door Repair Guides",
    intro: "Use detailed identification and measurement instructions to select the correct replacement hardware before ordering.",
    links: [["Window Balance Guide", "/guides/window-balance"], ["Window Operator Guide", "/guides/window-operator"], ["Patio Door Roller Guide", "/guides/patio-door-roller"], ["Weatherstripping Guide", "/guides/weatherstripping"]],
    schemaType: "CollectionPage",
  },
  "/resources": {
    title: "Window & Door Repair Resources | PDFs, Guides & Catalogs",
    description: "Download window and door measurement guides, product catalogs, installation references, and technical documents from All Window Door Parts.",
    heading: "Window & Door Repair Resources",
    intro: "Access measurement instructions, product references, technical PDFs, and other resources that help you identify and install replacement hardware.",
    links: [["Expert Guides", "/guides"], ["Shop Parts", "/shop"], ["Free Parts Identification", "/parts-identification"]],
    schemaType: "CollectionPage",
  },
  "/about": {
    title: "About All Window Door Parts | Veteran Owned, 40+ Years",
    description: "Learn about All Window Door Parts, a veteran-owned supplier with more than 40 years of hands-on window and door hardware experience.",
    heading: "About All Window Door Parts",
    intro: "We help homeowners, contractors, and property managers locate current, obsolete, and hard-to-find window and door replacement parts.",
    links: [["Shop Parts", "/shop"], ["Contact Us", "/contact"], ["Free Parts Identification", "/parts-identification"]],
    schemaType: "AboutPage",
  },
  "/contact": {
    title: "Contact All Window Door Parts | Product & Order Support",
    description: "Contact All Window Door Parts for product identification, order support, and replacement hardware questions. Call 785-533-0244 Monday through Friday.",
    heading: "Contact All Window Door Parts",
    intro: "Call 785-533-0244 or send a message for help with product identification, measurements, compatibility, existing orders, and general questions.",
    links: [["Free Parts Identification", "/parts-identification"], ["Shop Parts", "/shop"], ["Repair Resources", "/resources"]],
    schemaType: "ContactPage",
  },
  "/policies": {
    title: "Store Policies | All Window Door Parts",
    description: "Review All Window Door Parts shipping, returns, privacy, payment, and customer service policies before placing an order.",
    heading: "Store Policies",
    intro: "Review shipping, return, privacy, payment, and customer service information for purchases made through All Window Door Parts.",
    links: [["Shop Parts", "/shop"], ["Contact Customer Support", "/contact"]],
    schemaType: "WebPage",
  },
};

const GUIDE_PAGES = {
  "window-balance": ["How to Identify and Replace a Window Balance", "Identify channel, spiral, and constant-force balances using the correct length, stamp, tube diameter, and terminal style."],
  "window-operator": ["How to Identify a Window Operator", "Match single-arm, dual-arm, dyad, and scissor operators using handing, arm geometry, mounting holes, and manufacturer markings."],
  "patio-door-roller": ["How to Identify a Patio Door Roller", "Measure wheel diameter, housing dimensions, wheel material, and mounting style to select the correct patio door roller assembly."],
  weatherstripping: ["How to Identify Window and Door Weatherstripping", "Match kerf, bulb, fin-seal, pile, foam, and OEM weatherstripping profiles by cross-section and dimensions."],
  "door-lock": ["How to Identify Door Lock and Mortise Hardware", "Measure the faceplate, backset, handle spacing, latch style, and handing before ordering replacement lock hardware."],
  "glazing-bead": ["How to Identify Window Glazing Bead", "Match snap-in, kerf-in, and OEM glazing bead by profile shape, face width, leg depth, and window manufacturer."],
};

function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;",
  })[character]);
}

function normalizePath(value) {
  const raw = String(value || "/").split("?")[0];
  const normalized = raw.startsWith("/") ? raw : `/${raw}`;
  return normalized.replace(/\/{2,}/g, "/").replace(/\/+$/, "") || "/";
}

function canonicalProductPath(sku) {
  return `/product/${encodeURIComponent(String(sku))}`;
}

function readTemplate() {
  const templatePath = templateCandidates.find((candidate) => fs.existsSync(candidate));
  return templatePath ? fs.readFileSync(templatePath, "utf8") : null;
}

function staticMetadata(pathname) {
  if (STATIC_PAGES[pathname]) return { ...STATIC_PAGES[pathname], canonicalPath: pathname };
  if (!pathname.startsWith("/guides/")) return null;
  const slug = pathname.slice("/guides/".length);
  const guide = GUIDE_PAGES[slug];
  if (!guide) return null;
  return {
    title: `${guide[0]} | All Window Door Parts`,
    description: guide[1],
    heading: guide[0],
    intro: guide[1],
    canonicalPath: pathname,
    schemaType: "Article",
    links: [["All Repair Guides", "/guides"], ["Shop Replacement Parts", "/shop"], ["Free Parts Identification", "/parts-identification"]],
  };
}

function transientProductFallback(sku) {
  return {
    title: `Replacement Part ${sku} | All Window Door Parts`,
    description: `Find replacement window and door hardware for SKU ${sku}. Contact our experts for free parts identification and compatibility help.`,
    heading: `Replacement Part ${sku}`,
    intro: "Product details are temporarily unavailable. Search the catalog or send photos to our experts for free identification help.",
    canonicalPath: canonicalProductPath(sku),
    sku,
    links: [["Search the Catalog", `/shop?search=${encodeURIComponent(sku)}`], ["Free Parts Identification", "/parts-identification"]],
  };
}

async function productMetadata(pathname, origin) {
  if (!pathname.startsWith("/product/")) return undefined;
  const rawSku = pathname.slice("/product/".length);
  let sku;
  try { sku = decodeURIComponent(rawSku); } catch { sku = rawSku; }
  if (!sku) return null;

  let response;
  try {
    response = await fetch(`${origin}/api/products/${encodeURIComponent(sku)}`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(7000),
    });
  } catch (error) {
    console.error(`[seo-render] Unable to reach product API for ${sku}:`, error);
    return transientProductFallback(sku);
  }

  if (response.status === 404) return null;
  if (!response.ok) return transientProductFallback(sku);

  try {
    const product = await response.json();
    const name = product.name || product.title || sku;
    const description = String(product.description || `${name} replacement window and door hardware.`).replace(/\s+/g, " ").trim().slice(0, 160);
    const image = product.imageUrl || product.image_url || product.image || DEFAULT_IMAGE;
    const price = product.price == null ? null : Number(product.price);
    const inStock = product.inStock ?? product.in_stock ?? Number(product.stock || 0) > 0;
    const canonicalPath = canonicalProductPath(product.sku || sku);
    const canonical = `${BASE_URL}${canonicalPath}`;

    return {
      title: `${name} | All Window Door Parts`,
      description,
      heading: name,
      intro: description,
      canonicalPath,
      image,
      imageAlt: `${name} — SKU ${sku}`,
      schemaType: "Product",
      sku,
      links: [["Browse Related Parts", `/shop?search=${encodeURIComponent(name)}`], ["Free Parts Identification", "/parts-identification"], ["Shop All Parts", "/shop"]],
      structuredData: {
        "@context": "https://schema.org",
        "@graph": [
          {
            "@type": "Product",
            name,
            description,
            image: [image],
            sku: product.sku || sku,
            brand: { "@type": "Brand", name: product.brand || product.manufacturer || product.supplier || "All Window Door Parts" },
            ...(Number.isFinite(price) && price > 0 ? {
              offers: {
                "@type": "Offer",
                url: canonical,
                priceCurrency: "USD",
                price: price.toFixed(2),
                availability: inStock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
                itemCondition: "https://schema.org/NewCondition",
              },
            } : {}),
          },
          {
            "@type": "BreadcrumbList",
            itemListElement: [
              { "@type": "ListItem", position: 1, name: "Home", item: BASE_URL },
              { "@type": "ListItem", position: 2, name: "Shop", item: `${BASE_URL}/shop` },
              { "@type": "ListItem", position: 3, name, item: canonical },
            ],
          },
        ],
      },
    };
  } catch (error) {
    console.error(`[seo-render] Unable to parse product ${sku}:`, error);
    return transientProductFallback(sku);
  }
}

function pageStructuredData(metadata) {
  if (metadata.structuredData) return metadata.structuredData;
  return {
    "@context": "https://schema.org",
    "@type": metadata.schemaType || "WebPage",
    name: metadata.heading,
    description: metadata.description,
    url: `${BASE_URL}${metadata.canonicalPath}`,
    isPartOf: { "@type": "WebSite", name: "All Window Door Parts", url: BASE_URL },
  };
}

function managedHead(metadata, indexable = true) {
  const canonical = `${BASE_URL}${metadata.canonicalPath}`;
  const image = metadata.image || DEFAULT_IMAGE;
  const schema = JSON.stringify(pageStructuredData(metadata)).replace(/</g, "\\u003c");
  const robots = indexable ? "index, follow, max-image-preview:large" : "noindex, follow";
  return `
    <title>${escapeHtml(metadata.title)}</title>
    <meta name="description" content="${escapeHtml(metadata.description)}" />
    <meta name="robots" content="${robots}" />
    <link rel="canonical" href="${escapeHtml(canonical)}" />
    <meta property="og:type" content="${metadata.schemaType === "Product" ? "product" : "website"}" />
    <meta property="og:site_name" content="All Window Door Parts" />
    <meta property="og:title" content="${escapeHtml(metadata.title)}" />
    <meta name="theme-color" content="#0f172a" />
    <meta property="og:description" content="${escapeHtml(metadata.description)}" />
    <meta property="og:url" content="${escapeHtml(canonical)}" />
    <meta property="og:image" content="${escapeHtml(image)}" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:image:alt" content="${escapeHtml(metadata.imageAlt || metadata.heading)}" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapeHtml(metadata.title)}" />
    <meta name="twitter:description" content="${escapeHtml(metadata.description)}" />
    <meta name="twitter:image" content="${escapeHtml(image)}" />
    <script id="awdp-page-schema" type="application/ld+json">${schema}</script>`;
}

function stripManagedHead(html) {
  let previous;
  let current = html;
  do {
    previous = current;
    current = current
      .replace(/<title>[\s\S]*?<\/title>/i, "")
      .replace(/<meta\s+name=["'](?:description|robots|keywords)["'][^>]*>/gi, "")
      .replace(/<link\s+rel=["']canonical["'][^>]*>/gi, "")
      .replace(/<meta\s+property=["']og:[^"']+["'][^>]*>/gi, "")
      .replace(/<meta\s+name=["']twitter:[^"']+["'][^>]*>/gi, "")
      .replace(/<script\s+id=["']awdp-page-schema["'][\s\S]*?<\/script>/gi, "");
  } while (current !== previous);
  return current;
}

function findRootClose(html, rootOpenEnd) {
  const tokenPattern = /<div\b[^>]*>|<\/div\s*>/gi;
  tokenPattern.lastIndex = rootOpenEnd;
  let depth = 1;
  let match;
  while ((match = tokenPattern.exec(html))) {
    if (/^<\/div/i.test(match[0])) depth -= 1;
    else depth += 1;
    if (depth === 0) return match.index;
  }
  return -1;
}

function renderBody(metadata) {
  const image = metadata.image && metadata.image !== DEFAULT_IMAGE
    ? `<img src="${escapeHtml(metadata.image)}" alt="${escapeHtml(metadata.imageAlt || metadata.heading)}" width="640" height="640" loading="eager" style="display:block;max-width:520px;width:100%;height:auto;object-fit:contain;margin:24px auto;background:#fff;border:1px solid #e2e8f0;border-radius:12px" />`
    : "";
  const links = (metadata.links || []).map(([label, href]) => `<a href="${escapeHtml(href)}" style="display:inline-block;margin:6px 8px 6px 0;padding:12px 18px;border-radius:8px;background:#1e3a5f;color:#fff;text-decoration:none;font-weight:700">${escapeHtml(label)}</a>`).join("");
  const sku = metadata.sku ? `<p style="font-size:14px;color:#64748b">SKU: ${escapeHtml(metadata.sku)}</p>` : "";
  return `<main id="main-content" style="font-family:Inter,system-ui,sans-serif;max-width:1120px;margin:0 auto;padding:48px 24px;color:#0f172a">
    <nav aria-label="Breadcrumb" style="font-size:14px;margin-bottom:24px"><a href="/" style="color:#1d4ed8">Home</a> <span aria-hidden="true">/</span> <span>${escapeHtml(metadata.heading)}</span></nav>
    <h1 style="font-size:clamp(2rem,5vw,3.5rem);line-height:1.1;margin:0 0 18px">${escapeHtml(metadata.heading)}</h1>
    ${sku}
    <p style="font-size:18px;line-height:1.75;color:#475569;max-width:820px">${escapeHtml(metadata.intro || metadata.description)}</p>
    ${image}
    <div style="margin-top:28px">${links}</div>
    <section style="margin-top:48px;padding-top:28px;border-top:1px solid #e2e8f0">
      <h2 style="font-size:24px;margin-bottom:10px">Expert help finding the correct part</h2>
      <p style="line-height:1.7;color:#475569">All Window Door Parts is veteran owned and has more than 40 years of window and door hardware experience. Call <a href="tel:7855330244">785-533-0244</a> Monday through Friday, 8 a.m. to 5 p.m. Central Time.</p>
    </section>
  </main>`;
}

function injectPage(template, metadata, indexable = true) {
  let output = stripManagedHead(template);
  output = output.replace("</head>", `${managedHead(metadata, indexable)}\n  </head>`);
  const rootMarker = '<div id="root">';
  const rootStart = output.indexOf(rootMarker);
  if (rootStart === -1) return output;
  const rootOpenEnd = rootStart + rootMarker.length;
  const rootClose = findRootClose(output, rootOpenEnd);
  if (rootClose === -1) return output;
  return `${output.slice(0, rootOpenEnd)}\n${renderBody(metadata)}\n${output.slice(rootClose)}`;
}

function notFoundMetadata(pathname) {
  return {
    title: "Page Not Found | All Window Door Parts",
    description: "The requested page could not be found. Browse replacement window and door parts or use our free parts identification service.",
    heading: "Page Not Found",
    intro: "The page may have moved or no longer exists.",
    canonicalPath: pathname,
    links: [["Browse Parts", "/shop"], ["Free Parts Identification", "/parts-identification"], ["Return Home", "/"]],
    schemaType: "WebPage",
  };
}

export default async function handler(req, res) {
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.setHeader("Allow", "GET, HEAD");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const template = readTemplate();
  if (!template) return res.status(500).send("Unable to load storefront template");

  const pathname = normalizePath(req.query.path || req.url || "/");
  const origin = (process.env.SITE_URL || BASE_URL).replace(/\/+$/, "");
  const productResult = await productMetadata(pathname, origin);
  const metadata = productResult === undefined ? staticMetadata(pathname) : productResult;

  if (!metadata) {
    const html = injectPage(template, notFoundMetadata(pathname), false);
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "public, s-maxage=60, stale-while-revalidate=300");
    res.setHeader("X-Robots-Tag", "noindex, follow");
    return req.method === "HEAD" ? res.status(404).end() : res.status(404).send(html);
  }

  const html = injectPage(template, metadata, true);
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", pathname.startsWith("/product/")
    ? "public, s-maxage=300, stale-while-revalidate=86400"
    : "public, s-maxage=3600, stale-while-revalidate=86400");
  res.setHeader("X-Robots-Tag", "index, follow, max-image-preview:large");
  return req.method === "HEAD" ? res.status(200).end() : res.status(200).send(html);
}
