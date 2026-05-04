/// <reference types="vite/client" />

interface ImportMetaEnv {
  /**
   * Absolute origin of the Express API (no trailing slash), e.g. `https://api.example.com`.
   * When unset, requests use same-origin `/api` (requires reverse-proxy in production).
   */
  readonly VITE_API_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
