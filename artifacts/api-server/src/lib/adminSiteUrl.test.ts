import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { adminPortalUrl, getPublicSiteOrigin } from "./adminSiteUrl.js";

describe("getPublicSiteOrigin", () => {
  let siteUrl: string | undefined;
  let vercelUrl: string | undefined;

  beforeEach(() => {
    siteUrl = process.env.SITE_URL;
    vercelUrl = process.env.VERCEL_URL;
  });

  afterEach(() => {
    if (siteUrl === undefined) delete process.env.SITE_URL;
    else process.env.SITE_URL = siteUrl;
    if (vercelUrl === undefined) delete process.env.VERCEL_URL;
    else process.env.VERCEL_URL = vercelUrl;
  });

  it("uses SITE_URL when set", () => {
    process.env.SITE_URL = "https://preview.example.com/admin";
    delete process.env.VERCEL_URL;
    expect(getPublicSiteOrigin()).toBe("https://preview.example.com");
  });

  it("uses VERCEL_URL when SITE_URL is unset", () => {
    delete process.env.SITE_URL;
    process.env.VERCEL_URL = "my-app.vercel.app";
    expect(getPublicSiteOrigin()).toBe("https://my-app.vercel.app");
  });

  it("defaults to production origin", () => {
    delete process.env.SITE_URL;
    delete process.env.VERCEL_URL;
    expect(getPublicSiteOrigin()).toBe("https://www.allwindowdoorparts.com");
  });
});

describe("adminPortalUrl", () => {
  it("builds admin paths from SITE_URL", () => {
    process.env.SITE_URL = "https://www.allwindowdoorparts.com";
    delete process.env.VERCEL_URL;
    expect(adminPortalUrl("/admin/contacts")).toBe(
      "https://www.allwindowdoorparts.com/admin/contacts",
    );
  });
});
