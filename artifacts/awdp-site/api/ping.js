/**
 * Zero-dependency probe: if this 200s on Vercel, Node functions deploy; if not, routing/project root is wrong.
 */
export default function awdpApiPing(_req, res) {
  console.error(
    JSON.stringify({
      sessionId: "0e9545",
      hypothesisId: "H-ping",
      msg: "awdp-api-ping",
      ts: Date.now(),
    }),
  );
  res.statusCode = 200;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify({ ok: true, msg: "awdp-api-ping" }));
}
