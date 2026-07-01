import { afterEach, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import type { Express } from "express";

const ORIGINAL_ENV = { ...process.env };

async function importFreshApp() {
  const moduleId = `./app.js?test=${Date.now()}-${randomUUID()}`;
  return (await import(moduleId)).default;
}

async function requestApp(app: Express, path: string) {
  const server = await new Promise<Server>((resolve) => {
    const listeningServer = app.listen(0, () => resolve(listeningServer));
  });

  try {
    const address = server.address() as AddressInfo | string | null;
    if (!address || typeof address === "string") {
      throw new Error("Unable to determine test server address");
    }
    return await fetch(`http://127.0.0.1:${address.port}${path}`);
  } finally {
    await new Promise<void>((resolve) => server.close(resolve));
  }
}

describe("production SESSION_SECRET guard", () => {
  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it.each<[string | undefined]>([undefined, "change-me-in-production"])(
    "blocks admin session routes when production uses %p",
    async (secret) => {
      process.env.NODE_ENV = "production";
      if (secret === undefined) delete process.env.SESSION_SECRET;
      else process.env.SESSION_SECRET = secret;

      const app = await importFreshApp();
      const response = await requestApp(app, "/api/admin/session");

      expect(response.status).toBe(503);
      await expect(response.json()).resolves.toMatchObject({
        error: "Admin session secret is not configured.",
      });
    },
  );
});
