import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import pinoHttp from "pino-http";
import helmet from "helmet";
import compression from "compression";
import router from "./routes";
import paypalRouter from "./routes/paypal";
import priceMonitorRouter from "./routes/priceMonitor";
import adminAuthRouter from "./routes/adminAuth";
import adminOrdersRouter from "./routes/adminOrders";
import adminProductsRouter from "./routes/adminProducts";
import adminSettingsRouter from "./routes/adminSettings";
import adminImagesRouter from "./routes/adminImages";
import adminGenerateRouter from "./routes/adminGenerate";
import adminCsvImportRouter from "./routes/adminCsvImport";
import adminResourcesRouter from "./routes/adminResources";
import adminSisterPriceSyncRouter from "./routes/adminSisterPriceSync";
import { requireAdmin } from "./middleware/requireAdmin";
import { logger } from "./lib/logger";
import { WebhookHandlers } from "./webhookHandlers";
import sitemapRouter from "./routes/sitemap";
import { pool } from "@workspace/db";
import { isPayPalCheckoutOnly } from "./lib/checkoutMode.js";

function hasSecureSessionSecret() {
  return !!process.env.SESSION_SECRET && process.env.SESSION_SECRET !== "change-me-in-production";
}

function isProductionRuntime() {
  return process.env.NODE_ENV === "production" || !!process.env.VERCEL;
}

function shouldBlockAdminSessionRoutes() {
  return isProductionRuntime() && !hasSecureSessionSecret();
}

// Validate SESSION_SECRET
if (!hasSecureSessionSecret()) {
  logger.warn("SESSION_SECRET is using default value. Set a secure random value in production.");
}

const PgSession = connectPgSimple(session);

const app: Express = express();
app.disable("etag");
// Trust a bounded number of reverse-proxy hops. This keeps req.ip useful on
// Vercel/Replit without allowing arbitrary X-Forwarded-For values to win.
const configuredProxyHops = Number(process.env.TRUST_PROXY_HOPS ?? "1");
const trustedProxyHops =
  Number.isInteger(configuredProxyHops) && configuredProxyHops >= 1 && configuredProxyHops <= 5
    ? configuredProxyHops
    : 1;
app.set("trust proxy", trustedProxyHops);

// Security headers — helmet sets X-Frame-Options, HSTS, nosniff, referrer policy, etc.
// CSP allows PayPal, Google Fonts, and Google Tag Manager used by the frontend
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: [
          "'self'",
          "'unsafe-inline'",  // Vite HMR in dev; runtime-generated scripts
          "https://www.googletagmanager.com",
          "https://www.paypal.com",
          "https://js.paypalobjects.com",
          "https://embed.tawk.to",
        ],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        imgSrc: ["'self'", "data:", "https:", "blob:"],
        connectSrc: ["'self'", "https://www.paypal.com", "https://api.paypal.com", "wss://chat.tawk.to", "https://va.tawk.to"],
        frameSrc: ["'self'", "https://www.paypal.com", "https://tawk.to"],
        objectSrc: ["'none'"],
        upgradeInsecureRequests: [],
      },
    },
    // HSTS: force HTTPS for 1 year
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    },
    // Prevent clickjacking — allow same-origin frames only
    frameguard: { action: "sameorigin" },
    // Disable MIME type sniffing
    noSniff: true,
    // XSS filter
    xssFilter: true,
    // Referrer policy
    referrerPolicy: { policy: "strict-origin-when-cross-origin" },
  })
);

// Gzip/Brotli compression for all responses
app.use(compression());

// Stripe webhook MUST be registered before express.json() — needs raw Buffer body (skipped when PayPal-only)
if (!isPayPalCheckoutOnly()) {
  app.post(
    "/api/stripe/webhook",
    express.raw({ type: "application/json" }),
    async (req, res) => {
      const signature = req.headers["stripe-signature"];
      if (!signature) {
        return res.status(400).json({ error: "Missing stripe-signature header" });
      }
      try {
        const sig = Array.isArray(signature) ? signature[0] : signature;
        await WebhookHandlers.processWebhook(req.body as Buffer, sig);
        res.status(200).json({ received: true });
      } catch (err: any) {
        logger.error({ err }, "Stripe webhook error");
        res.status(400).json({ error: "Webhook processing failed" });
      }
    }
  );
} else {
  logger.info("Stripe webhook disabled (CHECKOUT_PAYPAL_ONLY)");
}

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
// credentials + wildcard Origin (*) is invalid in browsers → cross-site admin login shows "Failed to fetch".
// Dynamic delegate: if CORS_ORIGINS is set but omits the live custom domain, same-host browser Origins still work.
const configuredCorsOrigins =
  process.env.CORS_ORIGINS?.split(/[\s,]+/).map((s) => s.trim()).filter(Boolean) ?? [];

app.use(
  cors((req, callback) => {
    const credentials = true;
    const originHeader = req.header("Origin");

    if (!originHeader) {
      return callback(null, { origin: true, credentials });
    }
    if (configuredCorsOrigins.length === 0) {
      return callback(null, { origin: true, credentials });
    }
    if (configuredCorsOrigins.includes(originHeader)) {
      return callback(null, { origin: true, credentials });
    }
    try {
      const originHost = new URL(originHeader).hostname;
      if (originHost === req.hostname) {
        return callback(null, { origin: true, credentials });
      }
    } catch {
      /* ignore malformed Origin */
    }
    return callback(new Error(`Not allowed by CORS: ${originHeader}`));
  }),
);

// Disable HTTP caching on all API responses so browsers never serve stale data
app.use("/api", (_req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  next();
});

app.use("/api/admin", (req, res, next) => {
  if (!shouldBlockAdminSessionRoutes()) {
    return next();
  }

  if (req.path === "/env-check" || req.path.startsWith("/images/serve/")) {
    return next();
  }

  return res.status(503).json({
    error: "Admin session secret is not configured.",
    detail: "Set SESSION_SECRET to a secure random value before using admin authentication.",
  });
});

// Large admin CSV imports send JSON `{ rows }` from the browser; override with API_JSON_BODY_LIMIT if needed.
const jsonBodyLimit = process.env.API_JSON_BODY_LIMIT ?? "32mb";
app.use(express.json({ limit: jsonBodyLimit }));
app.use(express.urlencoded({ extended: true, limit: jsonBodyLimit }));

// Session middleware — uses PostgreSQL store for persistence across restarts
app.use(
  session({
    store: new PgSession({
      pool,
      tableName: "admin_sessions",
    }),
    name: "awdp_admin",
    secret: process.env.SESSION_SECRET || "change-me-in-production",
    resave: false,
    saveUninitialized: false,
    // Warn if using default secret in development
    genid: () => {
      if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET === "change-me-in-production") {
        logger.warn("Using default SESSION_SECRET. Set SESSION_SECRET environment variable for production.");
      }
      return Date.now().toString();
    },
    cookie: (() => {
      // On Vercel (and any HTTPS deployment), use secure cookies.
      // sameSite "lax" works for same-origin requests on Vercel.
      // Use SESSION_COOKIE_SAME_SITE=none only if the API is on a different domain from the frontend.
      const isVercel = !!process.env.VERCEL;
      const isProduction = process.env.NODE_ENV === "production" || isVercel;
      const sameSite = process.env.SESSION_COOKIE_SAME_SITE === "none" ? "none" : "lax";
      const secure = isProduction || sameSite === "none"; // SameSite=None requires Secure
      return {
        httpOnly: true,
        secure,
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        sameSite,
        path: "/",
      };
    })(),
  })
);

// Public routes
app.use("/api", router);
app.use("/api", paypalRouter);

// Admin auth routes (login/logout/check — no auth required for these)
app.use("/api", adminAuthRouter);

// All other /api/admin/* routes require authentication
app.use("/api/admin", requireAdmin);
app.use("/api", adminOrdersRouter);
app.use("/api", adminProductsRouter);
app.use("/api", adminSettingsRouter);
app.use("/api", adminImagesRouter);
app.use("/api", priceMonitorRouter);
app.use("/api", adminGenerateRouter);
app.use("/api/admin/csv-import", adminCsvImportRouter);
app.use("/api", adminResourcesRouter);
app.use("/api", adminSisterPriceSyncRouter);

// Sitemap at root (not under /api so search engines can reach it)
app.use(sitemapRouter);

// CORS and other middleware can pass `next(err)` — without this, Express 5 can end the invocation
// without a response (Vercel reports FUNCTION_INVOCATION_FAILED).
app.use((err: unknown, req: Request, res: Response, _next: NextFunction) => {
  if (res.headersSent) {
    return;
  }
  logger.error({ err }, "express error handler");
  const message =
    err && typeof err === "object" && "message" in err ? String((err as Error).message) : String(err);
  const errType =
    err && typeof err === "object" && "type" in err ? String((err as { type?: string }).type) : "";
  if (errType === "entity.too.large" || /entity too large/i.test(message)) {
    return res.status(413).json({
      error: "Request body too large",
      detail: `Send smaller import batches or raise API_JSON_BODY_LIMIT (current: ${jsonBodyLimit}).`,
    });
  }
  if (message.startsWith("Not allowed by CORS:")) {
    return res.status(403).json({ error: "Forbidden", detail: message });
  }
  return res.status(500).json({
    error: "Internal server error",
    ...(process.env.NODE_ENV === "production" ? {} : { detail: message }),
  });
});

export default app;
