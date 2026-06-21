/**
 * SSR Rendering Utilities
 * Helpers for rendering React to string and injecting metadata into HTML
 */

import React from "react";
import { renderToString } from "react-dom/server";
import type { PageMetadata } from "./ssr-metadata";

/**
 * Convert PageMetadata to PageSeo component props
 */
export function generatePageSeoProps(metadata: PageMetadata): Record<string, any> {
  return {
    title: metadata.title,
    description: metadata.description,
    keywords: metadata.keywords,
    path: metadata.canonicalPath,
    image: metadata.image,
    imageAlt: metadata.imageAlt,
    structuredData: metadata.structuredData,
  };
}

/**
 * Generate <meta> tags as HTML strings from metadata
 */
export function generateMetaTags(metadata: PageMetadata): string {
  const tags: string[] = [];

  // Title (handled separately in HTML template)
  // Canonical
  tags.push(
    `<link rel="canonical" href="https://www.allwindowdoorparts.com${metadata.canonicalPath}" />`
  );

  // Primary meta
  if (metadata.description) {
    tags.push(`<meta name="description" content="${escapeHtml(metadata.description)}" />`);
  }
  if (metadata.keywords) {
    tags.push(`<meta name="keywords" content="${escapeHtml(metadata.keywords)}" />`);
  }

  // Robots
  tags.push(
    `<meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1" />`
  );

  // Open Graph
  const ogTitle = metadata.title;
  const ogDescription = metadata.description || "";
  const ogImage = metadata.image || "https://www.allwindowdoorparts.com/opengraph.jpg";
  const ogUrl = `https://www.allwindowdoorparts.com${metadata.canonicalPath}`;

  tags.push(`<meta property="og:type" content="website" />`);
  tags.push(`<meta property="og:site_name" content="All Window Door Parts" />`);
  tags.push(`<meta property="og:title" content="${escapeHtml(ogTitle)}" />`);
  tags.push(`<meta property="og:description" content="${escapeHtml(ogDescription)}" />`);
  tags.push(`<meta property="og:url" content="${escapeHtml(ogUrl)}" />`);
  tags.push(`<meta property="og:image" content="${escapeHtml(ogImage)}" />`);
  tags.push(`<meta property="og:image:width" content="1200" />`);
  tags.push(`<meta property="og:image:height" content="630" />`);
  tags.push(`<meta property="og:image:alt" content="${escapeHtml(metadata.imageAlt || ogTitle)}" />`);
  tags.push(`<meta property="og:locale" content="en_US" />`);

  // Twitter Card
  tags.push(`<meta name="twitter:card" content="summary_large_image" />`);
  tags.push(`<meta name="twitter:title" content="${escapeHtml(ogTitle)}" />`);
  tags.push(`<meta name="twitter:description" content="${escapeHtml(ogDescription)}" />`);
  tags.push(`<meta name="twitter:image" content="${escapeHtml(ogImage)}" />`);
  tags.push(`<meta name="twitter:image:alt" content="${escapeHtml(metadata.imageAlt || ogTitle)}" />`);

  // Structured Data (JSON-LD)
  if (metadata.structuredData) {
    tags.push(
      `<script type="application/ld+json">${JSON.stringify(metadata.structuredData)}</script>`
    );
  }

  return tags.join("\n  ");
}

/**
 * Generate <title> tag content
 */
export function generateTitle(metadata: PageMetadata): string {
  return metadata.title;
}

/**
 * Escape HTML special characters
 */
export function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  };
  return text.replace(/[&<>"']/g, (char) => map[char] || char);
}

/**
 * Inject metadata into HTML template
 * Replaces placeholders with actual meta tags, title, and rendered content
 */
export function injectMetadataIntoHtml(
  template: string,
  metadata: PageMetadata,
  renderedContent?: string
): string {
  const metaTags = generateMetaTags(metadata);
  const title = generateTitle(metadata);

  let html = template;

  // Replace title placeholder or existing title tag
  html = html.replace(
    /<title>.*?<\/title>/i,
    `<title>${escapeHtml(title)}</title>`
  );

  // Replace meta tags placeholder (if it exists in template)
  // Otherwise append before </head>
  if (html.includes("<!-- SSR_META_TAGS -->")) {
    html = html.replace("<!-- SSR_META_TAGS -->", metaTags);
  } else {
    html = html.replace("</head>", `\n  ${metaTags}\n</head>`);
  }

  // Replace rendered content placeholder (if it exists in template)
  if (renderedContent && html.includes("<!-- SSR_ROOT_CONTENT -->")) {
    html = html.replace("<!-- SSR_ROOT_CONTENT -->", renderedContent);
  }

  return html;
}

/**
 * Render a React component to HTML string (minimal, SSR-only)
 * Returns safe HTML without hydration overhead
 */
export function renderComponentToString(component: React.ReactElement): string {
  try {
    return renderToString(component);
  } catch (error) {
    console.error("Error rendering component to string:", error);
    return "";
  }
}
