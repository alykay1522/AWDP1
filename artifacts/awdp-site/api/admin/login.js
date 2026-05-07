/**
 * Vercel Serverless Function — POST /api/admin/login
 * Authenticates admin with password stored in ADMIN_PASSWORD env var.
 */
export default function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  console.log('[AWDP API] POST /api/admin/login — attempt received');

  const { password } = req.body || {};

  if (!process.env.ADMIN_PASSWORD) {
    console.error('[AWDP API] ADMIN_PASSWORD env var is not set!');
    return res.status(500).json({ error: 'Server misconfiguration — admin password not set' });
  }

  if (password === process.env.ADMIN_PASSWORD) {
    console.log('[AWDP API] Admin login SUCCESS');
    return res.status(200).json({ success: true });
  } else {
    console.log('[AWDP API] Admin login FAILED — wrong password');
    return res.status(401).json({ error: 'Invalid password' });
  }
}
