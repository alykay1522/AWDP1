import { Router, type Request, type Response } from "express";
import rateLimit from "express-rate-limit";
import slowDown from "express-slow-down";
import { requireAdmin } from "../middleware/requireAdmin";
import { clearCsrfCookie, getOrCreateCsrfToken, setCsrfCookie } from "../middleware/csrfProtection";
import { verifyEmailTransport } from "../lib/email.js";
import { probeSmtpPort } from "../lib/smtpProbe.js";
import crypto from "crypto";
import { logger } from "../lib/logger";

const router = Router();

const loginSlowDown = slowDown({
  windowMs: 15 * 60 * 1000,
  delayAfter: 3,
  delayMs: (used) => (used - 3) * 500,
  maxDelayMs: 5000,
});

const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
  message: { error: "Too many login attempts. Please try again in 15 minutes." },
  statusCode: 429,
});

const adminDiagnosticsRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many diagnostic requests. Please try again in 15 minutes." },
  statusCode: 429,
});

router.get("/admin/csrf-token", (req: Request, res: Response) => {
  const csrfToken = getOrCreateCsrfToken(req);
  setCsrfCookie(res, csrfToken);
  res.setHeader("Cache-Control", "no-store");
  return res.json({ csrfToken });
});

router.post("/admin/login", loginSlowDown, loginRateLimiter, (req: Request, res: Response) => {
  const { password } = req.body as { password?: string };
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminPassword) {
    return res.status(503).json({ error: "Admin password not configured. Set ADMIN_PASSWORD environment variable." });
  }

  if (!password) {
    return res.status(401).json({ error: "Invalid password" });
  }

  const passwordBuffer = Buffer.from(password, "utf8");
  const adminPasswordBuffer = Buffer.from(adminPassword, "utf8");

  if (
    passwordBuffer.length !== adminPasswordBuffer.length ||
    !crypto.timingSafeEqual(passwordBuffer, adminPasswordBuffer)
  ) {
    return res.status(401).json({ error: "Invalid password" });
  }

  // Regenerate the session ID before granting privileges. Without this, a
  // session fixed on the victim's browser before login (subdomain XSS, a
  // pre-set cookie, a shared machine) stays valid and becomes an authenticated
  // admin session the moment the real admin signs in.
  req.session.regenerate((regenerateError) => {
    if (regenerateError) {
      logger.error({ err: regenerateError }, "Admin login session regenerate failed");
      return res.status(500).json({ error: "Session error" });
    }

    // Must come after regenerate(): regeneration discards existing session data,
    // which would otherwise orphan the CSRF token issued against the old session.
    const csrfToken = getOrCreateCsrfToken(req);
    setCsrfCookie(res, csrfToken);
    (req.session as any).adminAuthenticated = true;

    req.session.save((err) => {
      if (err) {
        logger.error({ err }, "Admin login session save failed");
        return res.status(500).json({ error: "Session error" });
      }
      return res.json({ ok: true, csrfToken });
    });
  });
});

router.post("/admin/logout", (req: Request, res: Response) => {
  req.session.destroy(() => {
    res.clearCookie("awdp_admin");
    clearCsrfCookie(res);
    res.json({ ok: true });
  });
});

router.get("/admin/auth-check", requireAdmin, (_req: Request, res: Response) => {
  res.json({ authenticated: true });
});

router.get("/admin/env-check", requireAdmin, (_req: Request, res: Response) => {
  res.json({
    DATABASE_URL: !!process.env.DATABASE_URL,
    SESSION_SECRET: !!process.env.SESSION_SECRET && process.env.SESSION_SECRET !== "change-me-in-production",
    ADMIN_PASSWORD: !!process.env.ADMIN_PASSWORD,
    PAYPAL_CLIENT_ID: !!process.env.PAYPAL_CLIENT_ID,
    PAYPAL_CLIENT_SECRET: !!process.env.PAYPAL_CLIENT_SECRET,
    SMTP_HOST: !!process.env.SMTP_HOST,
    SMTP_USER: !!process.env.SMTP_USER,
    SMTP_PASS: !!process.env.SMTP_PASS,
    SMTP_FROM: !!process.env.SMTP_FROM,
    SMTP_PORT: Number(process.env.SMTP_PORT || 465),
    SMTP_SECURE: process.env.SMTP_SECURE ?? "auto",
    RESEND_API_KEY: !!process.env.RESEND_API_KEY,
    PARTSID_RECIPIENTS: !!process.env.PARTSID_RECIPIENTS,
    CONTACT_RECIPIENTS: !!process.env.CONTACT_RECIPIENTS,
    BLOB_READ_WRITE_TOKEN: !!process.env.BLOB_READ_WRITE_TOKEN,
    VERCEL: !!process.env.VERCEL,
    NODE_ENV: process.env.NODE_ENV || "unset",
  });
});

router.get("/admin/email-health", requireAdmin, adminDiagnosticsRateLimiter, async (_req: Request, res: Response) => {
  const result = await verifyEmailTransport();
  res.status(200).json({
    ...result,
    smtpPort: Number(process.env.SMTP_PORT || 465),
    smtpSecure: process.env.SMTP_SECURE ?? "auto",
  });
});

router.get("/admin/smtp-ports", requireAdmin, adminDiagnosticsRateLimiter, async (_req: Request, res: Response) => {
  const [port465, port587] = await Promise.all([probeSmtpPort(465), probeSmtpPort(587)]);
  res.json({ port465, port587 });
});

router.get("/admin/session", (req: Request, res: Response) => {
  res.json({ authenticated: (req.session as any)?.adminAuthenticated === true });
});

export default router;
