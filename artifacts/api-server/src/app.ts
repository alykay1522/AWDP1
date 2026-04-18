import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import paypalRouter from "./routes/paypal";
import priceMonitorRouter from "./routes/priceMonitor";
import adminOrdersRouter from "./routes/adminOrders";
import adminProductsRouter from "./routes/adminProducts";
import adminSettingsRouter from "./routes/adminSettings";
import adminImagesRouter from "./routes/adminImages";
import adminGenerateRouter from "./routes/adminGenerate";
import adminCsvImportRouter from "./routes/adminCsvImport";
import { logger } from "./lib/logger";
import { WebhookHandlers } from "./webhookHandlers";
import sitemapRouter from "./routes/sitemap";

const app: Express = express();
app.disable("etag");

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
app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Disable HTTP caching on all API responses so browsers never serve stale data
app.use("/api", (_req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  next();
});

app.use("/api", router);
app.use("/api", paypalRouter);
app.use("/api", priceMonitorRouter);
app.use("/api", adminOrdersRouter);
app.use("/api", adminProductsRouter);
app.use("/api", adminSettingsRouter);
app.use("/api", adminImagesRouter);
app.use("/api", adminGenerateRouter);
app.use("/api/admin/csv-import", adminCsvImportRouter);

// Sitemap at root (not under /api so search engines can reach it)
app.use(sitemapRouter);

export default app;
