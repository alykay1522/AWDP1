import type { Request, Response, NextFunction } from "express";

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  // Product images are served to all visitors — skip auth for the serve path
  if (req.path.startsWith("/images/serve/")) {
    return next();
  }
  if ((req.session as any)?.adminAuthenticated === true) {
    return next();
  }
  return res.status(401).json({ error: "Unauthorized" });
}
