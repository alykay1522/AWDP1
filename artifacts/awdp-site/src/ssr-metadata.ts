/**
 * SSR Metadata Fetchers
 * Fetches page-specific metadata from the API for server-side rendering
 */

const API_BASE = process.env.VITE_API_BASE_URL || "http://localhost:3000/api";

export interface PageMetadata {
  title: string;
  description: string;
  keywords?: string;
  image?: string;
  imageAlt?: string;
  canonicalPath: string;
  structuredData?: object;
}

/**
 * Fetch metadata for /shop page
 */
export async function getShopMetadata(): Promise<PageMetadata> {
  try {
    const res = await fetch(`${API_BASE}/products?limit=1`);
    const data = await res.json();
    const count = (data as any).count || 35000;

    return {
      title: "Shop Window & Door Parts | 35,000+ Replacement Hardware",
      description:
        "Browse 35,000+ replacement window and door parts. Casement operators, sash balances, patio door rollers, locks, weatherstripping, and more. Fast shipping.",
      keywords:
        "window parts, door parts, replacement hardware, casement operators, window balances",
      canonicalPath: "/shop",
      image: "https://www.allwindowdoorparts.com/opengraph.jpg",
      imageAlt: "Shop All Window and Door Parts",
      structuredData: {
        "@context": "https://schema.org",
        "@type": "CollectionPage",
        name: "Shop Window & Door Parts",
        description:
          "Browse replacement window and door hardware from All Window Door Parts",
        url: "https://www.allwindowdoorparts.com/shop",
        mainEntity: {
          "@type": "OfferCatalog",
          name: "Window & Door Parts Catalog",
          numberOfItems: count,
        },
      },
    };
  } catch (error) {
    console.error("Error fetching shop metadata:", error);
    return {
      title: "Shop Window & Door Parts | 35,000+ Replacement Hardware",
      description:
        "Browse 35,000+ replacement window and door parts. Fast shipping and expert support.",
      canonicalPath: "/shop",
    };
  }
}

/**
 * Fetch metadata for /categories page
 */
export async function getCategoriesMetadata(): Promise<PageMetadata> {
  try {
    const res = await fetch(`${API_BASE}/categories`);
    const data = await res.json();
    const categories = Array.isArray(data) ? data : (data as any).categories || [];

    return {
      title:
        "Browse by Category | Window Balances, Hardware, Locks, Weatherstripping",
      description:
        "Shop window and door parts by category. Window balances, operators, sash hardware, door hardware, weatherstripping, screen parts, and more.",
      keywords:
        "window balances, window hardware, door hardware, weatherstripping, sash locks",
      canonicalPath: "/categories",
      image: "https://www.allwindowdoorparts.com/opengraph.jpg",
      imageAlt: "Browse Window and Door Parts by Category",
      structuredData: {
        "@context": "https://schema.org",
        "@type": "CollectionPage",
        name: "Browse by Category",
        description:
          "Shop window and door parts organized by category for easy browsing",
        url: "https://www.allwindowdoorparts.com/categories",
        mainEntity: {
          "@type": "ItemList",
          itemListElement: categories.slice(0, 7).map((cat: any, idx: number) => ({
            "@type": "ListItem",
            position: idx + 1,
            item: {
              "@type": "Thing",
              name: cat.name || cat,
            },
          })),
        },
      },
    };
  } catch (error) {
    console.error("Error fetching categories metadata:", error);
    return {
      title: "Browse by Category | Window & Door Parts",
      description:
        "Shop window and door parts organized by category for easy browsing.",
      canonicalPath: "/categories",
    };
  }
}

/**
 * Fetch metadata for /product/:sku page
 */
export async function getProductMetadata(sku: string): Promise<PageMetadata> {
  try {
    const res = await fetch(`${API_BASE}/products/${encodeURIComponent(sku)}`);
    if (!res.ok) {
      return getProductNotFoundMetadata(sku);
    }

    const product = (await res.json()) as any;

    const title = `${product.name || sku} | All Window Door Parts`;
    const description = (
      product.description ||
      `${product.name || sku} - replacement window and door hardware from All Window Door Parts`
    )
      .substring(0, 160)
      .trim();

    const image =
      product.image_url || "https://www.allwindowdoorparts.com/opengraph.jpg";

    return {
      title,
      description,
      keywords: `${product.name || ""}, ${product.category || ""}, window parts, door parts`,
      canonicalPath: `/product/${sku}`,
      image,
      imageAlt: product.name || sku,
      structuredData: {
        "@context": "https://schema.org",
        "@type": "Product",
        name: product.name,
        description: product.description,
        image: image,
        sku: product.sku,
        brand: {
          "@type": "Brand",
          name: product.brand || "All Window Door Parts",
        },
        ...(product.price !== undefined && product.price !== null && {
          offers: {
            "@type": "Offer",
            url: `https://www.allwindowdoorparts.com/product/${sku}`,
            priceCurrency: "USD",
            price: product.price,
            availability:
              (product.stock || 0) > 0
                ? "https://schema.org/InStock"
                : "https://schema.org/OutOfStock",
          },
        }),
      },
    };
  } catch (error) {
    console.error(`Error fetching product metadata for ${sku}:`, error);
    return getProductNotFoundMetadata(sku);
  }
}

/**
 * Fallback metadata for product not found
 */
function getProductNotFoundMetadata(sku: string): PageMetadata {
  return {
    title: `Product ${sku} | All Window Door Parts`,
    description: `Find replacement window and door parts at All Window Door Parts. Search SKU: ${sku}`,
    canonicalPath: `/product/${sku}`,
  };
}

/**
 * Fetch metadata for /guides page
 */
export async function getGuideHubMetadata(): Promise<PageMetadata> {
  return {
    title: "Expert Window & Door Repair Guides | Free How-To Articles",
    description:
      "Learn how to replace window balances, operators, weatherstripping, door rollers, and more. Free expert guides from All Window Door Parts.",
    keywords: "window repair, window balance, door repair, how-to guides",
    canonicalPath: "/guides",
    image: "https://www.allwindowdoorparts.com/opengraph.jpg",
    imageAlt: "Window & Door Repair Guides",
    structuredData: {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      name: "Window & Door Repair Guides",
      description:
        "Expert how-to guides for replacing window and door parts",
      url: "https://www.allwindowdoorparts.com/guides",
    },
  };
}

/**
 * Fetch metadata for individual guide pages
 */
export async function getGuideMetadata(guideSlug: string): Promise<PageMetadata> {
  const guides: Record<string, PageMetadata> = {
    "window-balance": {
      title:
        "How to Replace a Window Balance | Step-by-Step Guide | AWDP",
      description:
        "Learn how to identify and replace window balance hardware. Step-by-step guide from All Window Door Parts experts.",
      keywords: "window balance replacement, window balance repair, how to replace window balance",
      canonicalPath: "/guides/window-balance",
      image: "https://www.allwindowdoorparts.com/opengraph.jpg",
      imageAlt: "How to Replace a Window Balance",
    },
    "window-operator": {
      title:
        "How to Replace a Casement Window Operator | Expert Guide",
      description:
        "Replace your casement window operator. Learn the correct steps for Truth, Andersen, and other brands.",
      keywords: "casement operator replacement, window operator, crank operator",
      canonicalPath: "/guides/window-operator",
      image: "https://www.allwindowdoorparts.com/opengraph.jpg",
      imageAlt: "How to Replace a Casement Window Operator",
    },
    "patio-door-roller": {
      title:
        "How to Replace Patio Door Rollers | Easy Step-by-Step Instructions",
      description:
        "Repair your sliding patio door. Learn how to replace patio door rollers and get your door sliding smoothly again.",
      keywords: "patio door roller replacement, sliding door wheels, door roller repair",
      canonicalPath: "/guides/patio-door-roller",
      image: "https://www.allwindowdoorparts.com/opengraph.jpg",
      imageAlt: "How to Replace Patio Door Rollers",
    },
    "weatherstripping": {
      title:
        "How to Replace Weatherstripping | Window & Door Seals",
      description:
        "Stop drafts and improve energy efficiency. Learn how to replace weatherstripping on windows and doors.",
      keywords: "weatherstripping replacement, window seals, door weatherstripping",
      canonicalPath: "/guides/weatherstripping",
      image: "https://www.allwindowdoorparts.com/opengraph.jpg",
      imageAlt: "How to Replace Weatherstripping",
    },
    "door-lock": {
      title:
        "How to Replace a Window or Door Lock | AWDP Expert Guide",
      description:
        "Replace broken window and door locks. Step-by-step guide for safe, secure operation.",
      keywords: "door lock replacement, window lock repair, lock hardware",
      canonicalPath: "/guides/door-lock",
      image: "https://www.allwindowdoorparts.com/opengraph.jpg",
      imageAlt: "How to Replace Window and Door Locks",
    },
    "glazing-bead": {
      title:
        "How to Replace Glazing Beads | Glass Setting Guide",
      description:
        "Learn how to remove and install glazing beads to replace window glass. Expert step-by-step instructions.",
      keywords: "glazing bead replacement, window glass, glass setting",
      canonicalPath: "/guides/glazing-bead",
      image: "https://www.allwindowdoorparts.com/opengraph.jpg",
      imageAlt: "How to Replace Glazing Beads",
    },
  };

  return (
    guides[guideSlug] || {
      title: "Window & Door Repair Guide | All Window Door Parts",
      description: "Expert guide for window and door repair and maintenance.",
      canonicalPath: `/guides/${guideSlug}`,
    }
  );
}

/**
 * Fetch metadata for /about page
 */
export async function getAboutMetadata(): Promise<PageMetadata> {
  return {
    title: "About All Window Door Parts | Veteran Owned, 40+ Years",
    description:
      "Veteran-owned window and door parts supplier with 40+ years of industry experience. Specializing in replacement hardware for every window and door type.",
    keywords: "veteran owned, window parts supplier, door hardware, 40 years experience",
    canonicalPath: "/about",
    image: "https://www.allwindowdoorparts.com/opengraph.jpg",
    imageAlt: "All Window Door Parts — Veteran Owned Company",
    structuredData: {
      "@context": "https://schema.org",
      "@type": "LocalBusiness",
      name: "All Window Door Parts",
      description: "Veteran-owned window and door parts supplier",
      url: "https://www.allwindowdoorparts.com/about",
      telephone: "+17855330244",
      email: "Info@allwindowdoorparts.com",
    },
  };
}

/**
 * Fetch metadata for /parts-identification page
 */
export async function getPartsIdMetadata(): Promise<PageMetadata> {
  return {
    title: "Free Parts Identification | All Window Door Parts",
    description:
      "Can't identify your part? Use our free Parts ID service. Send a photo or description, and our experts will identify your window and door hardware.",
    keywords: "parts identification, identify window parts, identify door parts, free",
    canonicalPath: "/parts-identification",
    image: "https://www.allwindowdoorparts.com/opengraph.jpg",
    imageAlt: "Free Parts Identification Service",
    structuredData: {
      "@context": "https://schema.org",
      "@type": "Service",
      name: "Free Parts Identification",
      description:
        "Free service to identify window and door replacement parts",
      url: "https://www.allwindowdoorparts.com/parts-identification",
      provider: {
        "@type": "LocalBusiness",
        name: "All Window Door Parts",
        url: "https://www.allwindowdoorparts.com",
      },
    },
  };
}

/**
 * Fetch metadata for /resources page
 */
export async function getResourcesMetadata(): Promise<PageMetadata> {
  return {
    title: "Window & Door Repair Resources | PDFs, Guides & Tools",
    description:
      "Access free resources including measurement guides, installation instructions, and PDF catalogs for window and door parts.",
    keywords: "resources, measurement guides, installation guides, PDFs",
    canonicalPath: "/resources",
    image: "https://www.allwindowdoorparts.com/opengraph.jpg",
    imageAlt: "Window & Door Repair Resources",
  };
}

/**
 * Fetch metadata for /contact page
 */
export async function getContactMetadata(): Promise<PageMetadata> {
  return {
    title: "Contact All Window Door Parts | Support & Questions",
    description:
      "Get in touch with All Window Door Parts. Call 785-533-0244, email, or use our contact form for parts inquiries and customer support.",
    keywords: "contact, support, customer service, phone, email",
    canonicalPath: "/contact",
    image: "https://www.allwindowdoorparts.com/opengraph.jpg",
    imageAlt: "Contact All Window Door Parts",
  };
}

/**
 * Generic homepage metadata (rarely accessed via SSR, but included for completeness)
 */
export async function getHomeMetadata(): Promise<PageMetadata> {
  return {
    title: "All Window Door Parts — Window & Door Hardware",
    description:
      "Veteran-owned supplier with 40+ years experience. Shop 35,000+ window & door replacement parts: casement operators, sash balances, patio door rollers, locks, weatherstripping. Free Parts ID. Call 785-533-0244.",
    keywords:
      "window parts, door parts, window operators, casement operators, window balances, door locks, window rollers, glazing seals, screen frames, window hardware, door hardware, veteran owned",
    canonicalPath: "/",
    image: "https://www.allwindowdoorparts.com/opengraph.jpg",
    imageAlt: "All Window Door Parts — Veteran Owned Window and Door Hardware",
  };
}
