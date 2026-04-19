import { Router, type Request, type Response } from "express";
import { requireAdmin } from "../middleware/requireAdmin";

const router = Router();

router.post("/admin/login", (req: Request, res: Response) => {
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
    if (err) return res.status(500).json({ error: "Session error" });
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
