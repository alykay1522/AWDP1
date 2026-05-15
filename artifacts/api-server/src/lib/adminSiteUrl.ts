/**
 * Public site origin for links in staff notification emails (admin portal, etc.).
 * Prefer explicit `SITE_URL`; on Vercel use `VERCEL_URL` when set.
 */
export function getPublicSiteOrigin(): string {
  const explicit = process.env.SITE_URL?.trim();
  if (explicit) {
    try {
      return new URL(explicit).origin;
    } catch {
      /* fall through */
    }
  }

  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) {
    const host = vercel.replace(/^https?:\/\//i, "");
    return `https://${host}`;
  }

  return "https://www.allwindowdoorparts.com";
}

export function adminPortalUrl(path: "/admin/parts-id" | "/admin/contacts"): string {
  const base = getPublicSiteOrigin().replace(/\/$/, "");
  return `${base}${path}`;
}
