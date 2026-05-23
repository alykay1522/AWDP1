// The backend now runs as same-origin Vercel serverless functions. Keep this
// side-effect module as a compatibility no-op so stale VITE_API_BASE_URL values
// cannot send browser /api calls to an old external Express host.
if (import.meta.env.VITE_API_BASE_URL && import.meta.env.DEV) {
  console.warn("Ignoring VITE_API_BASE_URL; AWDP uses same-origin /api routes.");
}
