import { Router, type Request, type Response } from "express";
import rateLimit from "express-rate-limit";
import slowDown from "express-slow-down";
import { requireAdmin } from "../middleware/requireAdmin";

const router = Router();

// Progressive delay: after 3 attempts, add 500 ms per extra attempt (up to 5 s)
const loginSlowDown = slowDown({
  windowMs: 15 * 60 * 1000,
  delayAfter: 3,
  delayMs: (used) => (used - 3) * 500,
  maxDelayMs: 5000,
});

// Hard cap: 10 attempts per 15-minute window — return 429 when exceeded
const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
  message: { error: "Too many login attempts. Please try again in 15 minutes." },
  statusCode: 429,
});

router.post("/admin/login", loginSlowDown, loginRateLimiter, (req: Request, res: Response) => {
  const { password } = req.body as { password?: string };
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminPassword) {
    return res.status(503).json({ error: "Admin password not configured. Set ADMIN_PASSWORD environment variable." });
  }

  if (!password || password !== adminPassword) {
    return res.status(401).json({ error: "Invalid password" });
  }

  (req.session as any).adminAuthenticated = true;
  req.session.save((err) => {
    if (err) {
      console.error("Session save error:", err);
      return res.status(500).json({ error: "Session error" });
    }
    return res.json({ ok: true });
  });
});

router.post("/admin/logout", (req: Request, res: Response) => {
  req.session.destroy(() => {
    res.clearCookie("awdp_admin");
    res.json({ ok: true });
  });
});

router.get("/admin/auth-check", requireAdmin, (_req: Request, res: Response) => {
  res.json({ authenticated: true });
});

export default router;
