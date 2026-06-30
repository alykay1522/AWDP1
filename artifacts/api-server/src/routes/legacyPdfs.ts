import { Router } from "express";
import { legacyPdfRedirects } from "../data/legacyPdfRedirects";

const router = Router();

router.get("/legacy-pdf/:year/:month/:filename", (req, res) => {
  const { year, month, filename } = req.params;
  const legacyPath = `${year}/${month}/${filename}`;
  const recoveredUrl = legacyPdfRedirects[legacyPath];

  if (recoveredUrl) {
    res.setHeader("Cache-Control", "public, max-age=3600");
    return res.redirect(302, recoveredUrl);
  }

  res.status(410);
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("X-Robots-Tag", "noindex, nofollow");
  return res.send(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>PDF no longer available | All Window Door Parts</title>
</head>
<body style="font-family:Inter,system-ui,sans-serif;max-width:720px;margin:64px auto;padding:0 24px;color:#0f172a;line-height:1.6">
  <h1>That archived PDF could not be recovered</h1>
  <p>The original WordPress upload was deleted and no verified copy has been located for <strong>${escapeHtml(filename)}</strong>.</p>
  <p><a href="/resources">Browse the recovered PDF library</a> or <a href="/parts-identification">request free parts identification help</a>.</p>
</body>
</html>`);
});

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (character) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      "'": "&#39;",
      '"': "&quot;",
    };
    return entities[character];
  });
}

export default router;
