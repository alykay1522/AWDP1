
from __future__ import annotations

import json
from pathlib import Path
from textwrap import dedent

ROOT = Path(__file__).resolve().parents[1]


def path(rel: str) -> Path:
    return ROOT / rel


def replace_once(rel: str, old: str, new: str) -> None:
    target = path(rel)
    text = target.read_text(encoding="utf-8")
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{rel}: expected exactly one match, found {count}")
    target.write_text(text.replace(old, new, 1), encoding="utf-8")


def write(rel: str, content: str) -> None:
    target = path(rel)
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(dedent(content).lstrip(), encoding="utf-8")


def update_json(rel: str, mutate) -> None:
    target = path(rel)
    data = json.loads(target.read_text(encoding="utf-8"))
    mutate(data)
    target.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")


# React Query cache invalidation after delete-all.
replace_once(
    "artifacts/awdp-site/src/pages/admin-products-list.tsx",
    '      qc.invalidateQueries({ queryKey: ["/api/admin/products"] });\n',
    '      qc.invalidateQueries({ queryKey: ["admin-products"] });\n'
    '      qc.invalidateQueries({ queryKey: ["/api/catalog/stats"] });\n',
)

# Do not attach bearer tokens to arbitrary absolute URLs.
replace_once(
    "artifacts/awdp-site/src/lib/api-client/custom-fetch.ts",
    '''function resolveUrl(input: RequestInfo | URL): string {
  if (typeof input === "string") return input;
  if (isUrl(input)) return input.toString();
  return input.url;
}
''',
    '''function resolveUrl(input: RequestInfo | URL): string {
  if (typeof input === "string") return input;
  if (isUrl(input)) return input.toString();
  return input.url;
}

function isTrustedAuthTarget(input: RequestInfo | URL): boolean {
  const requestUrl = resolveUrl(input);
  const browserOrigin =
    typeof window !== "undefined" && window.location?.origin
      ? window.location.origin
      : null;
  const trustedBase = _baseUrl || browserOrigin;

  // Relative URLs are same-origin in browsers. In non-browser runtimes they are
  // only usable when a base URL has been configured.
  if (!/^[A-Za-z][A-Za-z\d+.-]*:/.test(requestUrl) && !requestUrl.startsWith("//")) {
    return browserOrigin !== null || trustedBase !== null;
  }

  if (!trustedBase) return false;

  try {
    return new URL(requestUrl, trustedBase).origin === new URL(trustedBase).origin;
  } catch {
    return false;
  }
}
''',
)
replace_once(
    "artifacts/awdp-site/src/lib/api-client/custom-fetch.ts",
    '''  if (_authTokenGetter && !headers.has("authorization")) {
''',
    '''  if (_authTokenGetter && !headers.has("authorization") && isTrustedAuthTarget(input)) {
''',
)

# Owner email failures must not suppress the customer confirmation.
replace_once(
    "artifacts/api-server/src/emailNotifier.ts",
    '''  if (staff.length > 0) {
    await transport.sendMail({ from: FROM_EMAIL, to: staff.join(", "), subject: `New Order ${payload.orderId} — $${payload.total}`, html: ownerHtml(payload) });
  }
''',
    '''  if (staff.length > 0) {
    try {
      await transport.sendMail({ from: FROM_EMAIL, to: staff.join(", "), subject: `New Order ${payload.orderId} — $${payload.total}`, html: ownerHtml(payload) });
    } catch (error) {
      console.error("[email] Failed to send owner order notification", error);
    }
  }
''',
)

# Keep regression tests aligned with the corrected email behavior.
replace_once(
    "artifacts/api-server/src/emailNotifier.test.ts",
    '''  it("propagates error when sendMail rejects", async () => {
    sendMailMock.mockRejectedValueOnce(new Error("SMTP connection refused"));
    await expect(sendOrderNotification(SAMPLE_PAYLOAD)).rejects.toThrow(
      "SMTP connection refused"
    );
  });
''',
    '''  it("still sends the customer confirmation when the staff notification fails", async () => {
    sendMailMock.mockRejectedValueOnce(new Error("SMTP connection refused"));
    await expect(sendOrderNotification(SAMPLE_PAYLOAD)).resolves.not.toThrow();
    expect(sendMailMock).toHaveBeenCalledTimes(2);
    expect(sendMailMock).toHaveBeenLastCalledWith(
      expect.objectContaining({ to: "jane@example.com" })
    );
  });
''',
)

# The documented recipient format is comma-separated; treating semicolons as
# separators can turn part of an invalid address into a valid recipient.
replace_once(
    "artifacts/api-server/src/lib/notifyRecipients.ts",
    "    .split(/[,;]+/)\n",
    '    .split(",")\n',
)

# Dependency hygiene and test scripts.
def mutate_api_package(data: dict) -> None:
    deps = data["dependencies"]
    deps["@vercel/blob"] = "^0.27.3"
    deps["date-fns"] = "^4.1.0"
    deps["multer"] = "^2.2.0"
    deps["nodemailer"] = "^9.0.1"
    deps["stripe"] = "^22.2.2"
    deps.pop("@types/sharp", None)
    data.setdefault("scripts", {})["test"] = "vitest run"

update_json("artifacts/api-server/package.json", mutate_api_package)


def mutate_root_api_package(data: dict) -> None:
    deps = data["dependencies"]
    deps.pop("@types/sharp", None)
    deps["@vercel/blob"] = "^0.27.3"
    deps["multer"] = "^2.2.0"
    deps["nodemailer"] = "^9.0.1"
    deps["stripe"] = "^22.2.2"

update_json("api-server-package.json", mutate_root_api_package)


def mutate_site_package(data: dict) -> None:
    data.setdefault("scripts", {})["test"] = "vitest run src"
    data.setdefault("devDependencies", {})["vitest"] = "^4.1.8"

update_json("artifacts/awdp-site/package.json", mutate_site_package)

# SSR metadata escaping.
replace_once(
    "artifacts/awdp-site/src/ssr-utils.ts",
    '''  // Title (handled separately in HTML template)
  // Canonical
  tags.push(
    `<link rel="canonical" href="https://www.allwindowdoorparts.com${metadata.canonicalPath}" />`
  );
''',
    '''  // Title (handled separately in HTML template)
  // Canonical
  const canonicalUrl = `https://www.allwindowdoorparts.com${metadata.canonicalPath}`;
  tags.push(
    `<link rel="canonical" href="${escapeHtml(canonicalUrl)}" />`
  );
''',
)
replace_once(
    "artifacts/awdp-site/src/ssr-utils.ts",
    '''      `<script type="application/ld+json">${JSON.stringify(metadata.structuredData)}</script>`
''',
    '''      `<script type="application/ld+json">${serializeJsonLd(metadata.structuredData)}</script>`
''',
)
replace_once(
    "artifacts/awdp-site/src/ssr-utils.ts",
    '''/**
 * Escape HTML special characters
 */
export function escapeHtml(text: string): string {
''',
    '''/**
 * Serialize JSON-LD without allowing a value to terminate the script element.
 */
export function serializeJsonLd(value: object): string {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\\u2028/g, "\\u2028")
    .replace(/\\u2029/g, "\\u2029");
}

/**
 * Escape HTML special characters
 */
export function escapeHtml(text: string): string {
''',
)

# Strict, finite shipping configuration.
write(
    "artifacts/api-server/src/lib/shipping.ts",
    r'''
    /**
     * Shipping rate calculator — uses the highest standard carrier rate (UPS/FedEx Ground)
     * so the customer is never under-charged. Actual shipping may be less; we contact
     * customers if there is a significant difference.
     */

    export interface ShippingRate {
      cost: number;
      label: string;
      carrier: string;
    }

    export function parseShippingFlatRate(value: string | undefined): number | null {
      if (value === undefined || value === "") return null;
      if (!/^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/.test(value)) return null;

      const parsed = Number(value);
      return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
    }

    export function calculateShipping(subtotal: number): ShippingRate {
      if (!Number.isFinite(subtotal) || subtotal < 0) {
        throw new TypeError("Shipping subtotal must be a finite, non-negative number");
      }

      const flat = parseShippingFlatRate(process.env.SHIPPING_FLAT_RATE);
      if (flat !== null) {
        return {
          cost: flat,
          label: flat === 0 ? "Free Shipping" : `Shipping & Handling — $${flat.toFixed(2)}`,
          carrier: "UPS/FedEx/USPS",
        };
      }

      let cost: number;
      if (subtotal < 75) cost = 22.40;
      else if (subtotal < 150) cost = 29.90;
      else if (subtotal < 300) cost = 37.40;
      else if (subtotal < 500) cost = 52.45;
      else cost = 74.95;

      return {
        cost,
        label: `Shipping & Handling (UPS/FedEx Ground) — $${cost.toFixed(2)}`,
        carrier: "UPS/FedEx Ground",
      };
    }
    ''',
)

# Correct schema.org list structure and preserve zero-price offers.
replace_once(
    "artifacts/awdp-site/src/ssr-metadata.ts",
    '''        itemListElement: categories.slice(0, 7).map((cat: any, idx: number) => ({
          "@type": "Thing",
          position: idx + 1,
          name: cat.name || cat,
        })),
''',
    '''        mainEntity: {
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
''',
)
replace_once(
    "artifacts/awdp-site/src/ssr-metadata.ts",
    '''    const res = await fetch(`${API_BASE}/products/${sku}`);
''',
    '''    const res = await fetch(`${API_BASE}/products/${encodeURIComponent(sku)}`);
''',
)
replace_once(
    "artifacts/awdp-site/src/ssr-metadata.ts",
    '''        ...(product.price && {
''',
    '''        ...(product.price !== undefined && product.price !== null && {
''',
)

# Restore the established reciprocal AWDP SKU cipher.
write(
    "artifacts/api-server/src/lib/skuCipher.ts",
    r'''
    const NUM_TO_LETTER: Record<string, string> = {
      "1": "P", "2": "R", "3": "O", "4": "F", "5": "I",
      "6": "T", "7": "A", "8": "B", "9": "L", "0": "E",
    };

    const LETTER_TO_NUM: Record<string, string> = {
      P: "1", R: "2", O: "3", F: "4", I: "5",
      T: "6", A: "7", B: "8", L: "9", E: "0",
    };

    export function applySkuCipher(input: string): string {
      return input
        .toUpperCase()
        .split("")
        .map((char) => NUM_TO_LETTER[char] ?? LETTER_TO_NUM[char] ?? char)
        .join("");
    }

    export function buildSku(originalSku: string): string {
      const clean = originalSku.trim();
      if (clean.toUpperCase().startsWith("AWDP-")) return clean.toUpperCase();
      return `AWDP-${applySkuCipher(clean)}`;
    }
    ''',
)
replace_once(
    "artifacts/api-server/src/routes/adminProducts.ts",
    '''import { resolveProductCategory } from "../lib/resolveProductCategory";
''',
    '''import { resolveProductCategory } from "../lib/resolveProductCategory";
import { buildSku } from "../lib/skuCipher.js";
''',
)
replace_once(
    "artifacts/api-server/src/routes/adminProducts.ts",
    '''function buildSku(originalSku: string): string {
  const clean = originalSku.trim().toUpperCase();
  // If already prefixed, return as-is
  if (clean.startsWith("AWDP-")) return clean;
  return "AWDP-" + clean;
}

''',
    "",
)

# Encode dynamic SKU segments in the standalone renderer.
replace_once(
    "artifacts/awdp-site/api/render.mjs",
    '''        const res = await fetch(`${apiBase}/products/${sku}`);
''',
    '''        const res = await fetch(`${apiBase}/products/${encodeURIComponent(sku)}`);
''',
)

# PayPal amount validation and a shared tolerance predicate.
write(
    "artifacts/api-server/src/lib/paypalAmounts.ts",
    r'''
    export const PAYPAL_AMOUNT_TOLERANCE = 0.02;

    export function amountsMatch(
      capturedAmount: number | null,
      expectedAmount: number,
      tolerance = PAYPAL_AMOUNT_TOLERANCE,
    ): boolean {
      return capturedAmount !== null
        && Number.isFinite(capturedAmount)
        && Number.isFinite(expectedAmount)
        && Number.isFinite(tolerance)
        && tolerance >= 0
        && Math.abs(capturedAmount - expectedAmount) <= tolerance;
    }
    ''',
)
replace_once(
    "artifacts/api-server/src/routes/checkout.ts",
    '''import { logger } from "../lib/logger";
''',
    '''import { logger } from "../lib/logger";
import { amountsMatch } from "../lib/paypalAmounts.js";
''',
)
replace_once(
    "artifacts/api-server/src/routes/checkout.ts",
    '''      if (capturedAmount === null || Math.abs(capturedAmount - localTotal) > 0.02) {
''',
    '''      if (!amountsMatch(capturedAmount, localTotal)) {
''',
)
replace_once(
    "artifacts/api-server/src/paypalClient.ts",
    '''  const subtotal = params.items.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  );
  const total = subtotal + params.shippingCost;
''',
    '''  if (!Number.isFinite(params.shippingCost) || params.shippingCost < 0) {
    throw new TypeError("PayPal shippingCost must be a finite, non-negative number");
  }

  const subtotal = params.items.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  );
  if (!Number.isFinite(subtotal) || subtotal < 0) {
    throw new TypeError("PayPal subtotal must be a finite, non-negative number");
  }

  const total = subtotal + params.shippingCost;
''',
)

# SMTP is validated lazily; parts-ID template matches the route payload.
write(
    "artifacts/api-server/src/lib/email.ts",
    r'''
    import nodemailer from "nodemailer";
    import { format } from "date-fns";

    export interface ContactSubmission {
      name: string;
      email: string;
      phone?: string;
      message: string;
      submittedAt: string | Date;
    }

    export interface PartsIdSubmission {
      ticketId: string;
      submissionId: string;
      name: string;
      email: string;
      phone?: string;
      description: string;
      windowDoorBrand?: string;
      windowDoorAge?: string;
      imageUrl?: string | null;
      submittedAt: string | Date;
    }

    function esc(value?: string | null): string {
      if (!value) return "";
      const map: Record<string, string> = {
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;",
      };
      return value.replace(/[&<>"']/g, (char) => map[char] ?? char);
    }

    function formatSubmittedAt(date: string | Date): string {
      try {
        return format(new Date(date), "MMMM dd, yyyy hh:mm a");
      } catch {
        return String(date);
      }
    }

    function createTransporter() {
      const host = process.env.SMTP_HOST;
      const user = process.env.SMTP_USER;
      const pass = process.env.SMTP_PASS;
      const port = Number(process.env.SMTP_PORT ?? "465");

      if (!host || !user || !pass || !Number.isInteger(port) || port <= 0 || port > 65535) {
        console.warn("[email] SMTP is not fully configured; skipping notification");
        return null;
      }

      return nodemailer.createTransport({
        host,
        port,
        secure: process.env.SMTP_SECURE !== "false",
        auth: { user, pass },
      });
    }

    export async function forwardContactEmail(submission: ContactSubmission) {
      const transporter = createTransporter();
      if (!transporter) return null;

      const html = `
        <h2>New Contact Form Submission</h2>
        <p><strong>Name:</strong> ${esc(submission.name)}</p>
        <p><strong>Email:</strong> ${esc(submission.email)}</p>
        <p><strong>Phone:</strong> ${esc(submission.phone)}</p>
        <p><strong>Message:</strong><br>${esc(submission.message)}</p>
        <p><strong>Submitted At:</strong> ${formatSubmittedAt(submission.submittedAt)}</p>
      `;

      return transporter.sendMail({
        from: `"All Window Door Parts" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
        to: process.env.CONTACT_RECIPIENTS,
        replyTo: submission.email,
        subject: "New Contact Form Submission",
        html,
      });
    }

    export async function forwardPartsIdEmail(submission: PartsIdSubmission) {
      const transporter = createTransporter();
      if (!transporter) return null;

      const imageHtml = submission.imageUrl
        ? `<p><strong>Image:</strong> <a href="${esc(submission.imageUrl)}">View uploaded image</a></p>`
        : "";

      const html = `
        <h2>New Parts ID Request</h2>
        <p><strong>Ticket ID:</strong> ${esc(submission.ticketId)}</p>
        <p><strong>Submission ID:</strong> ${esc(submission.submissionId)}</p>
        <p><strong>Name:</strong> ${esc(submission.name)}</p>
        <p><strong>Email:</strong> ${esc(submission.email)}</p>
        <p><strong>Phone:</strong> ${esc(submission.phone)}</p>
        <p><strong>Description:</strong><br>${esc(submission.description)}</p>
        <p><strong>Window/Door Brand:</strong> ${esc(submission.windowDoorBrand)}</p>
        <p><strong>Window/Door Age:</strong> ${esc(submission.windowDoorAge)}</p>
        ${imageHtml}
        <p><strong>Submitted At:</strong> ${formatSubmittedAt(submission.submittedAt)}</p>
      `;

      return transporter.sendMail({
        from: `"All Window Door Parts" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
        to: process.env.PARTSID_RECIPIENTS || process.env.CONTACT_RECIPIENTS,
        replyTo: submission.email,
        subject: `New Parts ID Request — ${submission.ticketId}`,
        html,
      });
    }
    ''',
)

# API tsconfig extends project defaults.
write(
    "api/tsconfig.json",
    r'''
    {
      "extends": "../tsconfig.base.json",
      "compilerOptions": {
        "allowJs": true,
        "noEmit": true,
        "types": ["node"]
      },
      "include": ["./**/*"]
    }
    ''',
)

# Parts-ID image validation and size limits.
write(
    "artifacts/api-server/src/routes/partsId.ts",
    r'''
    import { Router, type IRouter } from "express";
    import { db } from "@workspace/db";
    import { partsIdRequestsTable } from "@workspace/db/schema";
    import { randomUUID } from "crypto";
    import { forwardPartsIdEmail } from "../lib/email.js";
    import { put } from "@vercel/blob";

    const router: IRouter = Router();
    const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
    const IMAGE_TYPES = {
      png: { mime: "image/png", extension: "png" },
      jpeg: { mime: "image/jpeg", extension: "jpg" },
      jpg: { mime: "image/jpeg", extension: "jpg" },
      webp: { mime: "image/webp", extension: "webp" },
    } as const;

    function isValidSingleEmail(value: unknown): value is string {
      if (typeof value !== "string") return false;
      if (/[,;\r\n\t?&#%]/.test(value)) return false;
      return /^[a-zA-Z0-9.+_~-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(value);
    }

    function decodeImageDataUri(value: unknown):
      | { buffer: Buffer; mime: string; extension: string }
      | null {
      if (typeof value !== "string") return null;

      const match = /^data:image\/(png|jpe?g|webp);base64,([A-Za-z0-9+/]+={0,2})$/i.exec(value);
      if (!match) return null;

      const type = IMAGE_TYPES[match[1].toLowerCase() as keyof typeof IMAGE_TYPES];
      const payload = match[2];
      const padding = payload.endsWith("==") ? 2 : payload.endsWith("=") ? 1 : 0;
      const estimatedBytes = Math.floor((payload.length * 3) / 4) - padding;
      if (estimatedBytes <= 0 || estimatedBytes > MAX_IMAGE_BYTES) return null;

      const buffer = Buffer.from(payload, "base64");
      if (buffer.length <= 0 || buffer.length > MAX_IMAGE_BYTES) return null;

      return { buffer, mime: type.mime, extension: type.extension };
    }

    router.post(["/parts-id", "/parts-identification"], async (req, res) => {
      try {
        const {
          name,
          email,
          phone,
          description,
          windowDoorBrand,
          windowDoorAge,
          imageBase64,
        } = req.body;

        if (!name || !email || !description) {
          return res.status(400).json({ error: "Missing required fields" });
        }

        if (!isValidSingleEmail(email)) {
          return res.status(400).json({ error: "Invalid email format" });
        }

        const ticketId = `PID-${Date.now()}-${Math.floor(Math.random() * 9999)}`;
        const submissionId = randomUUID();
        let imageUrl: string | null = null;

        if (imageBase64 !== undefined && imageBase64 !== null && imageBase64 !== "") {
          const image = decodeImageDataUri(imageBase64);
          if (!image) {
            return res.status(400).json({
              error: "Image must be a valid PNG, JPEG, or WebP data URI no larger than 8 MB",
            });
          }

          const blob = await put(
            `parts-id/${submissionId}.${image.extension}`,
            image.buffer,
            { access: "public", contentType: image.mime },
          );
          imageUrl = blob.url;
        }

        await db.insert(partsIdRequestsTable).values({
          ticketId,
          name,
          email,
          phone,
          description,
          windowDoorBrand,
          windowDoorAge,
          imageUrl,
          status: "pending",
        });

        try {
          await forwardPartsIdEmail({
            ticketId,
            submissionId,
            name,
            email,
            phone,
            description,
            windowDoorBrand,
            windowDoorAge,
            imageUrl,
            submittedAt: new Date(),
          });
        } catch (emailError) {
          console.error("Parts ID request saved, but notification email failed:", emailError);
        }

        return res.json({ success: true, ticketId, imageUrl });
      } catch (err) {
        console.error("Parts ID Error:", err);
        return res.status(500).json({ error: "Internal server error" });
      }
    });

    export default router;
    ''',
)

# Checkout displays server-calculated shipping before PayPal opens.
replace_once(
    "artifacts/awdp-site/src/pages/checkout.tsx",
    '''                      const data = await res.json();
                      // Write to ref immediately — always readable in onApprove regardless of render timing
                      orderDataRef.current = { paypalOrderId: data.paypalOrderId, orderId: data.orderId };
''',
    '''                      const data = await res.json();
                      const shippingCost = Number(data.shippingCost);
                      if (!Number.isFinite(shippingCost) || shippingCost < 0) {
                        throw new Error("Checkout returned an invalid shipping charge");
                      }
                      setShippingInfo({
                        cost: shippingCost,
                        label: data.shippingLabel || "Shipping & Handling",
                      });
                      // Write to ref immediately — always readable in onApprove regardless of render timing
                      orderDataRef.current = { paypalOrderId: data.paypalOrderId, orderId: data.orderId };
''',
)

# SSR route matching must not let "/" match every path.
replace_once(
    "artifacts/awdp-site/src/ssr-routes.ts",
    '''  // Normalize trailing slashes
  const normalized = pathname.replace(/\/$/, "") || "/";
''',
    '''  // Normalize leading/trailing slashes
  const withLeadingSlash = pathname.startsWith("/") ? pathname : `/${pathname}`;
  const normalized = withLeadingSlash.replace(/\/$/, "") || "/";
''',
)
replace_once(
    "artifacts/awdp-site/src/ssr-routes.ts",
    '''  return ssrRoutes.some((route) => pathname.startsWith(route) || pathname === route);
''',
    '''  return ssrRoutes.some((candidate) => {
    if (candidate === "/") return route === "/";
    return route === candidate || route.startsWith(`${candidate}/`);
  });
''',
)

# Bound Express trust proxy configuration.
replace_once(
    "artifacts/api-server/src/app.ts",
    '''// Trust reverse proxy — works for both Replit and Vercel
app.set("trust proxy", true);
''',
    '''// Trust a bounded number of reverse-proxy hops. This keeps req.ip useful on
// Vercel/Replit without allowing arbitrary X-Forwarded-For values to win.
const configuredProxyHops = Number(process.env.TRUST_PROXY_HOPS ?? "1");
const trustedProxyHops =
  Number.isInteger(configuredProxyHops) && configuredProxyHops >= 1 && configuredProxyHops <= 5
    ? configuredProxyHops
    : 1;
app.set("trust proxy", trustedProxyHops);
''',
)

# Shared client-side shipping estimate.
write(
    "artifacts/awdp-site/src/lib/shipping-estimate.ts",
    r'''
    export function estimateShipping(subtotal: number): number {
      if (!Number.isFinite(subtotal) || subtotal < 0) {
        throw new TypeError("Shipping subtotal must be a finite, non-negative number");
      }
      if (subtotal < 75) return 22.40;
      if (subtotal < 150) return 29.90;
      if (subtotal < 300) return 37.40;
      if (subtotal < 500) return 52.45;
      return 74.95;
    }
    ''',
)
replace_once(
    "artifacts/awdp-site/src/components/layout.tsx",
    '''import { SITE_CUSTOMER_EMAIL, SITE_CUSTOMER_MAILTO } from "../lib/siteContact.js";
''',
    '''import { SITE_CUSTOMER_EMAIL, SITE_CUSTOMER_MAILTO } from "../lib/siteContact.js";
import { estimateShipping } from "../lib/shipping-estimate.js";
''',
)
replace_once(
    "artifacts/awdp-site/src/components/layout.tsx",
    '''                        // Mirror server-side shipping tiers so customer sees the charge before PayPal opens
                        let ship = 22.40;
                        if (totalPrice >= 500)      ship = 74.95;
                        else if (totalPrice >= 300) ship = 52.45;
                        else if (totalPrice >= 150) ship = 37.40;
                        else if (totalPrice >= 75)  ship = 29.90;
''',
    '''                        // Mirror server-side tiers so the estimate is visible before PayPal opens.
                        const ship = estimateShipping(totalPrice);
''',
)

# react-resizable-panels v4 compatibility.
resizable_wrapper = r'''
"use client"

import { GripVertical } from "lucide-react"
import * as ResizablePrimitive from "react-resizable-panels"

import { cn } from "@/lib/utils"

type PanelGroupProps = React.ComponentProps<typeof ResizablePrimitive.Group> & {
  direction?: "horizontal" | "vertical"
}

const ResizablePanelGroup = ({ direction, orientation, className, ...props }: PanelGroupProps) => (
  <ResizablePrimitive.Group
    orientation={orientation ?? direction}
    className={cn(
      "flex h-full w-full aria-[orientation=vertical]:flex-col",
      className
    )}
    {...props}
  />
)

const ResizablePanel = ResizablePrimitive.Panel

const ResizableHandle = ({
  withHandle,
  className,
  ...props
}: React.ComponentProps<typeof ResizablePrimitive.Separator> & {
  withHandle?: boolean
}) => (
  <ResizablePrimitive.Separator
    className={cn(
      "relative flex w-px items-center justify-center bg-border after:absolute after:inset-y-0 after:left-1/2 after:w-1 after:-translate-x-1/2 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-offset-1 aria-[orientation=vertical]:h-px aria-[orientation=vertical]:w-full aria-[orientation=vertical]:after:left-0 aria-[orientation=vertical]:after:h-1 aria-[orientation=vertical]:after:w-full aria-[orientation=vertical]:after:-translate-y-1/2 aria-[orientation=vertical]:after:translate-x-0 [&[aria-orientation=vertical]>div]:rotate-90",
      className
    )}
    {...props}
  >
    {withHandle && (
      <div className="z-10 flex h-4 w-3 items-center justify-center rounded-sm border bg-border">
        <GripVertical className="h-2.5 w-2.5" />
      </div>
    )}
  </ResizablePrimitive.Separator>
)

export { ResizablePanelGroup, ResizablePanel, ResizableHandle }
'''
write("artifacts/awdp-site/src/components/ui/resizable.tsx", resizable_wrapper)
write("artifacts/mockup-sandbox/src/components/ui/resizable.tsx", resizable_wrapper)

# SSR serverless handler improvements.
replace_once(
    "artifacts/awdp-site/api/ssr.mjs",
    '''function normalizePath(pathname) {
  return (pathname || "/").replace(/\/$/, "") || "/";
}
''',
    '''function normalizePath(pathname) {
  const raw = String(pathname || "/");
  const withLeadingSlash = raw.startsWith("/") ? raw : `/${raw}`;
  return withLeadingSlash.replace(/\/$/, "") || "/";
}
''',
)
replace_once(
    "artifacts/awdp-site/api/ssr.mjs",
    '''async function fetchMetadata(pathname) {
  const apiBase =
    process.env.VITE_API_BASE_URL ||
    process.env.API_SERVER_URL ||
    process.env.EXPRESS_API_ORIGIN ||
    "http://localhost:3000/api";

  const route = normalizePath(pathname);
''',
    '''function resolveApiBase(req) {
  const configured =
    process.env.VITE_API_BASE_URL ||
    process.env.API_SERVER_URL ||
    process.env.EXPRESS_API_ORIGIN;
  if (configured) return configured.replace(/\/$/, "");

  const forwardedHost = String(req?.headers?.["x-forwarded-host"] || "")
    .split(",", 1)[0]
    .trim();
  const host = forwardedHost || String(req?.headers?.host || "").trim();
  if (host && /^[A-Za-z0-9.-]+(?::\d{1,5})?$/.test(host)) {
    const forwardedProto = String(req?.headers?.["x-forwarded-proto"] || "https")
      .split(",", 1)[0]
      .trim();
    const protocol = forwardedProto === "http" ? "http" : "https";
    return `${protocol}://${host}/api`;
  }

  return process.env.NODE_ENV === "production"
    ? "https://www.allwindowdoorparts.com/api"
    : "http://localhost:3000/api";
}

async function fetchMetadata(pathname, apiBase = resolveApiBase(), options = {}) {
  const fetchImpl = options.fetchImpl || fetch;
  const route = normalizePath(pathname);
''',
)
replace_once(
    "artifacts/awdp-site/api/ssr.mjs",
    '''          const res = await fetch(`${apiBase}/products/${sku}`, {
''',
    '''          const res = await fetchImpl(`${apiBase}/products/${encodeURIComponent(sku)}`, {
''',
)
replace_once(
    "artifacts/awdp-site/api/ssr.mjs",
    '''function readTemplate() {
  try {
    const templatePath = path.join(publicDir, "index.html");
''',
    '''function readTemplate(templatePath = path.join(publicDir, "index.html")) {
  try {
''',
)
replace_once(
    "artifacts/awdp-site/api/ssr.mjs",
    '''  const pathname = req.query.path || "/";
''',
    '''  const pathname = normalizePath(req.query.path || "/");
''',
)
replace_once(
    "artifacts/awdp-site/api/ssr.mjs",
    '''  const shouldSSR =
    isBot &&
    publicRoutes.some(
      (route) => normalizePath(pathname) === normalizePath(route) || pathname.startsWith(route)
    );
''',
    '''  const shouldSSR = isBot && publicRoutes.some((candidate) => {
    const route = normalizePath(candidate);
    if (route === "/") return pathname === "/";
    if (candidate.endsWith("/")) return pathname.startsWith(`${route}/`);
    return pathname === route || pathname.startsWith(`${route}/`);
  });
''',
)
replace_once(
    "artifacts/awdp-site/api/ssr.mjs",
    '''  const metadata = await fetchMetadata(pathname);
''',
    '''  const metadata = await fetchMetadata(pathname, resolveApiBase(req));
''',
)
with path("artifacts/awdp-site/api/ssr.mjs").open("a", encoding="utf-8") as handle:
    handle.write(
        '\nexport { fetchMetadata, injectMetadataIntoHtml, isBotUserAgent, normalizePath, readTemplate, resolveApiBase };\n'
    )

# Standalone renderer route gate and request-aware API origin.
replace_once(
    "artifacts/awdp-site/api/render.mjs",
    '''function parsePath(pathname) {
  return (pathname || "/").replace(/\/$/, "") || "/";
}
''',
    '''function parsePath(pathname) {
  const raw = String(pathname || "/");
  const withLeadingSlash = raw.startsWith("/") ? raw : `/${raw}`;
  return withLeadingSlash.replace(/\/$/, "") || "/";
}
''',
)
replace_once(
    "artifacts/awdp-site/api/render.mjs",
    '''async function fetchMetadata(pathname) {
  const apiBase =
    process.env.VITE_API_BASE_URL ||
    process.env.API_SERVER_URL ||
    "http://localhost:3000/api";

  const route = parsePath(pathname);
''',
    '''function resolveApiBase(req) {
  const configured = process.env.VITE_API_BASE_URL || process.env.API_SERVER_URL;
  if (configured) return configured.replace(/\/$/, "");

  const host = String(req?.headers?.["x-forwarded-host"] || req?.headers?.host || "")
    .split(",", 1)[0]
    .trim();
  if (host && /^[A-Za-z0-9.-]+(?::\d{1,5})?$/.test(host)) {
    const forwardedProto = String(req?.headers?.["x-forwarded-proto"] || "https")
      .split(",", 1)[0]
      .trim();
    const protocol = forwardedProto === "http" ? "http" : "https";
    return `${protocol}://${host}/api`;
  }

  return process.env.NODE_ENV === "production"
    ? "https://www.allwindowdoorparts.com/api"
    : "http://localhost:3000/api";
}

async function fetchMetadata(pathname, apiBase = resolveApiBase()) {
  const route = parsePath(pathname);
''',
)
replace_once(
    "artifacts/awdp-site/api/render.mjs",
    '''  const pathname = req.query.path || "/";
''',
    '''  const pathname = parsePath(req.query.path || "/");
''',
)
replace_once(
    "artifacts/awdp-site/api/render.mjs",
    '''  const shouldSSR =
    isBot &&
    publicRoutes.some((route) => pathname === route || pathname.startsWith(route));
''',
    '''  const shouldSSR = isBot && publicRoutes.some((candidate) => {
    const route = parsePath(candidate);
    if (route === "/") return pathname === "/";
    if (candidate.endsWith("/")) return pathname.startsWith(`${route}/`);
    return pathname === route || pathname.startsWith(`${route}/`);
  });
''',
)
replace_once(
    "artifacts/awdp-site/api/render.mjs",
    '''  const metadata = await fetchMetadata(pathname);
''',
    '''  const metadata = await fetchMetadata(pathname, resolveApiBase(req));
''',
)

# Focused regression tests.
write(
    "artifacts/api-server/src/lib/shipping.test.ts",
    r'''
    import { afterEach, describe, expect, it } from "vitest";
    import { calculateShipping, parseShippingFlatRate } from "./shipping.js";

    const original = process.env.SHIPPING_FLAT_RATE;
    afterEach(() => {
      if (original === undefined) delete process.env.SHIPPING_FLAT_RATE;
      else process.env.SHIPPING_FLAT_RATE = original;
    });

    describe("shipping", () => {
      it.each([
        [0, 22.40], [74.99, 22.40], [75, 29.90], [150, 37.40], [300, 52.45], [500, 74.95],
      ])("calculates the expected tier for %s", (subtotal, expected) => {
        delete process.env.SHIPPING_FLAT_RATE;
        expect(calculateShipping(subtotal).cost).toBe(expected);
      });

      it.each(["12oops", "Infinity", "NaN", "-1", "1.234", " 12 "])(
        "rejects malformed override %s",
        (value) => expect(parseShippingFlatRate(value)).toBeNull(),
      );

      it("accepts a valid zero override", () => {
        process.env.SHIPPING_FLAT_RATE = "0";
        expect(calculateShipping(100).cost).toBe(0);
      });
    });
    ''',
)
write(
    "artifacts/api-server/src/lib/paypalAmounts.test.ts",
    r'''
    import { describe, expect, it } from "vitest";
    import { amountsMatch } from "./paypalAmounts.js";

    describe("PayPal amount tolerance", () => {
      it("accepts differences at the two-cent boundary", () => {
        expect(amountsMatch(100.02, 100)).toBe(true);
      });

      it("rejects differences above the two-cent boundary", () => {
        expect(amountsMatch(100.021, 100)).toBe(false);
      });

      it.each([null, Number.NaN, Number.POSITIVE_INFINITY])(
        "rejects invalid captured amount %s",
        (value) => expect(amountsMatch(value, 100)).toBe(false),
      );
    });
    ''',
)
write(
    "artifacts/api-server/src/lib/skuCipher.test.ts",
    r'''
    import { describe, expect, it } from "vitest";
    import { applySkuCipher, buildSku } from "./skuCipher.js";

    describe("AWDP SKU cipher", () => {
      it("preserves the reciprocal PROFITABLE mapping", () => {
        expect(applySkuCipher("1234567890-PROFITABLE")).toBe("PROFITABLE-1234567890");
      });

      it("builds legacy-compatible SKUs", () => {
        expect(buildSku("35-1234")).toBe("AWDP-OI-PROF");
      });

      it("does not re-cipher an existing AWDP SKU", () => {
        expect(buildSku("awdp-oi-prof")).toBe("AWDP-OI-PROF");
      });
    });
    ''',
)
write(
    "artifacts/awdp-site/src/lib/shipping-estimate.test.ts",
    r'''
    import { describe, expect, it } from "vitest";
    import { estimateShipping } from "./shipping-estimate.js";

    describe("client shipping estimate", () => {
      it.each([
        [50, 22.40], [75, 29.90], [150, 37.40], [300, 52.45], [500, 74.95],
      ])("matches the server tier at %s", (subtotal, expected) => {
        expect(estimateShipping(subtotal)).toBe(expected);
      });

      it("rejects invalid subtotals", () => {
        expect(() => estimateShipping(Number.NaN)).toThrow();
      });
    });
    ''',
)
write(
    "artifacts/awdp-site/tests/ssr-route.test.mjs",
    r'''
    import assert from "node:assert/strict";
    import { mkdtemp, writeFile } from "node:fs/promises";
    import os from "node:os";
    import path from "node:path";
    import { test } from "node:test";
    import handler, {
      fetchMetadata,
      isBotUserAgent,
      normalizePath,
      readTemplate,
      resolveApiBase,
    } from "../api/ssr.mjs";

    test("detects crawlers and normalizes rewritten paths", () => {
      assert.equal(isBotUserAgent("Googlebot/2.1"), true);
      assert.equal(isBotUserAgent("Mozilla/5.0"), false);
      assert.equal(normalizePath("shop"), "/shop");
      assert.equal(normalizePath("/shop/"), "/shop");
    });

    test("resolves same-origin API from request host", () => {
      assert.equal(
        resolveApiBase({ headers: { host: "example.com", "x-forwarded-proto": "https" } }),
        "https://example.com/api",
      );
    });

    test("product metadata encodes SKU and handles API success/failure", async () => {
      let requested = "";
      const success = await fetchMetadata("/product/A/B", "https://example.com/api", {
        fetchImpl: async (url) => {
          requested = url;
          return { ok: true, json: async () => ({ name: "Test Part", price: 5 }) };
        },
      });
      assert.equal(requested, "https://example.com/api/products/A%2FB");
      assert.match(success.title, /Test Part/);

      const fallback = await fetchMetadata("/product/MISSING", "https://example.com/api", {
        fetchImpl: async () => ({ ok: false }),
      });
      assert.match(fallback.title, /MISSING/);
    });

    test("reads an HTML template", async () => {
      const dir = await mkdtemp(path.join(os.tmpdir(), "awdp-ssr-"));
      const template = path.join(dir, "index.html");
      await writeFile(template, "<html><head><title>x</title></head><body></body></html>");
      assert.match(readTemplate(template), /<title>x<\/title>/);
    });

    test("rejects unsupported methods before reading the template", async () => {
      const response = mockResponse();
      await handler({ method: "POST", headers: {}, query: {} }, response);
      assert.equal(response.statusCode, 405);
      assert.deepEqual(response.body, { error: "Method not allowed" });
    });

    test("does not classify a non-public bot path as SSR metadata", async () => {
      const metadata = await fetchMetadata("/admin/login", "https://example.com/api", {
        fetchImpl: async () => { throw new Error("should not fetch"); },
      });
      assert.equal(metadata, null);
    });

    function mockResponse() {
      return {
        statusCode: 200,
        headers: {},
        body: undefined,
        setHeader(name, value) { this.headers[name] = value; return this; },
        status(code) { this.statusCode = code; return this; },
        json(value) { this.body = value; return this; },
        send(value) { this.body = value; return this; },
        end() { return this; },
      };
    }
    ''',
)

# Encode route params in the generated metadata fetcher too.
replace_once(
    "artifacts/awdp-site/api/ssr.mjs",
    '''          const res = await fetchImpl(`${apiBase}/products/${sku}`, {
''',
    '''          const res = await fetchImpl(`${apiBase}/products/${encodeURIComponent(sku)}`, {
''',
)

# Self-remove the one-shot automation files before committing.
path("scripts/apply-review-fixes.py").unlink(missing_ok=True)
path(".github/workflows/apply-review-fixes.yml").unlink(missing_ok=True)
