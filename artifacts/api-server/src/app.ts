import express, { type Express } from "express";
import cors from "cors";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import pinoHttp from "pino-http";
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
import { requireAdmin } from "./middleware/requireAdmin";
import { logger } from "./lib/logger";
import { WebhookHandlers } from "./webhookHandlers";
import sitemapRouter from "./routes/sitemap";
import { pool } from "@workspace/db";

const PgSession = connectPgSimple(session);

const app: Express = express();
app.disable("etag");
// Trust Replit's reverse proxy so secure cookies work over HTTPS
app.set("trust proxy", 1);

// Stripe webhook MUST be registered before express.json() — needs raw Buffer body
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
app.use(cors({ credentials: true }));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

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
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      sameSite: "lax",
    },
  })
);

// Disable HTTP caching on all API responses so browsers never serve stale data
app.use("/api", (_req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  next();
});

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

// Sitemap at root (not under /api so search engines can reach it)
app.use(sitemapRouter);

export default app;
