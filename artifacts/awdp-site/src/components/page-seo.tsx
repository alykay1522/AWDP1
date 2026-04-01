import { Helmet } from "react-helmet-async";

const SITE_NAME = "All Window Door Parts";
const BASE_URL = "https://www.allwindowdoorparts.com";
const DEFAULT_IMAGE = `${BASE_URL}/opengraph.jpg`;

interface PageSeoProps {
  title?: string;
  description?: string;
  path?: string;
  image?: string;
  noIndex?: boolean;
  type?: "website" | "product";
  structuredData?: object;
}

export function PageSeo({
  title,
  description,
  path = "/",
  image = DEFAULT_IMAGE,
  noIndex = false,
  type = "website",
  structuredData,
}: PageSeoProps) {
  const fullTitle = title ? `${title} | ${SITE_NAME}` : `${SITE_NAME} | Window & Door Hardware — Veteran Owned`;
  const canonical = `${BASE_URL}${path}`;

  return (
    <Helmet>
      <title>{fullTitle}</title>
      {description && <meta name="description" content={description} />}
      <link rel="canonical" href={canonical} />
      {noIndex && <meta name="robots" content="noindex, nofollow" />}

      <meta property="og:title" content={fullTitle} />
      {description && <meta property="og:description" content={description} />}
      <meta property="og:url" content={canonical} />
      <meta property="og:type" content={type} />
      <meta property="og:image" content={image} />

      <meta name="twitter:title" content={fullTitle} />
      {description && <meta name="twitter:description" content={description} />}
      <meta name="twitter:image" content={image} />

      {structuredData && (
        <script type="application/ld+json">
          {JSON.stringify(structuredData)}
        </script>
      )}
    </Helmet>
  );
}
