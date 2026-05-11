import { Router, type IRouter } from "express";
import { HealthCheckResponse } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/healthz", (_req, res) => {
  const databaseUrl = process.env.DATABASE_URL ?? "";
  const isProductionLike = process.env.NODE_ENV === "production" || process.env.VERCEL === "1";

  if (isProductionLike && /(?:localhost|127\.0\.0\.1|\[?::1\]?)/i.test(databaseUrl)) {
    res.status(500).json({
      status: "error",
      error: "DATABASE_URL points to localhost in production; set it to the hosted Postgres connection string.",
    });
    return;
  }

  const data = HealthCheckResponse.parse({ status: "ok" });
  res.json(data);
});

export default router;
