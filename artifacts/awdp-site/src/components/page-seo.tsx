import { Helmet } from "react-helmet-async";

const SITE_NAME = "All Window Door Parts";
const BASE_URL = "https://www.allwindowdoorparts.com";
const DEFAULT_IMAGE = `${BASE_URL}/opengraph.jpg`;
const DEFAULT_IMAGE_WIDTH = "1200";
const DEFAULT_IMAGE_HEIGHT = "630";

interface PageSeoProps {
  title?: string;
  description?: string;
  path?: string;
  image?: string;
  imageAlt?: string;
  noIndex?: boolean;
  type?: "website" | "product";
  structuredData?: object | object[];
  keywords?: string;
  publishedTime?: string;
  modifiedTime?: string;
}

export function PageSeo({
  title,
  description,
  path = "/",
  image = DEFAULT_IMAGE,
  imageAlt,
  noIndex = false,
  type = "website",
  structuredData,
  keywords,
  publishedTime,
  modifiedTime,
}: PageSeoProps) {
  const fullTitle = title
    ? `${title} | ${SITE_NAME}`
    : `${SITE_NAME} | Window & Door Hardware — Veteran Owned`;
  const canonical = `${BASE_URL}${path}`;
  const ogImage = image || DEFAULT_IMAGE;
  const ogImageAlt = imageAlt || fullTitle;

  const ldJsonItems = structuredData
    ? Array.isArray(structuredData)
      ? structuredData
      : [structuredData]
    : [];

  return (
    <Helmet>
      <title>{fullTitle}</title>
      {description && <meta name="description" content={description} />}
      {keywords && <meta name="keywords" content={keywords} />}
      <link rel="canonical" href={canonical} />
      {noIndex ? (
        <meta name="robots" content="noindex, nofollow" />
      ) : (
        <meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1" />
      )}

      {/* Open Graph */}
      <meta property="og:site_name" content={SITE_NAME} />
      <meta property="og:title" content={fullTitle} />
      {description && <meta property="og:description" content={description} />}
      <meta property="og:url" content={canonical} />
      <meta property="og:type" content={type} />
      <meta property="og:image" content={ogImage} />
      <meta property="og:image:width" content={DEFAULT_IMAGE_WIDTH} />
      <meta property="og:image:height" content={DEFAULT_IMAGE_HEIGHT} />
      <meta property="og:image:alt" content={ogImageAlt} />
      <meta property="og:locale" content="en_US" />
      {publishedTime && <meta property="article:published_time" content={publishedTime} />}
      {modifiedTime && <meta property="article:modified_time" content={modifiedTime} />}

      {/* Twitter Card */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      {description && <meta name="twitter:description" content={description} />}
      <meta name="twitter:image" content={ogImage} />
      <meta name="twitter:image:alt" content={ogImageAlt} />

      {/* Structured Data */}
      {ldJsonItems.length > 0 && (
        <script type="application/ld+json">
          {JSON.stringify(ldJsonItems.length === 1 ? ldJsonItems[0] : ldJsonItems)}
        </script>
      )}
    </Helmet>
  );
}
