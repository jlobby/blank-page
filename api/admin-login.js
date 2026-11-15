import { json, body, ip, limit } from '../lib/util.js';
import { verifyGoogle, newSession } from '../lib/admin.js';

// POST /api/admin-login {credential} -> {session} when the Google account is the admin
export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'POST only' });
  if (!(await limit('adminlogin', ip(req), 10, 600))) return json(res, 429, { error: 'slow down' });
  if (!(await verifyGoogle(body(req).credential))) return json(res, 403, { error: 'not allowed' });
  json(res, 200, { session: await newSession() });
}
