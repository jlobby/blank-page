import { createHash, timingSafeEqual } from 'node:crypto';
import { json, body, ip, limit } from '../lib/util.js';
import { verifyGoogle, newSession } from '../lib/admin.js';

// The admin password lives only in the ADMIN_PASSWORD environment variable.
const passwordOk = given => {
  const real = process.env.ADMIN_PASSWORD;
  if (!real || real.length < 8 || typeof given !== 'string' || !given) return false;
  const h = v => createHash('sha256').update(v).digest(); // equal lengths for a constant-time compare
  return timingSafeEqual(h(given), h(real));
};

// POST /api/admin-login {password} or {credential} -> {session} for the admin only
export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'POST only' });
  if (!(await limit('adminlogin', ip(req), 10, 600))) return json(res, 429, { error: 'slow down' });
  const b = body(req);
  const ok = b.password != null ? passwordOk(b.password) : await verifyGoogle(b.credential);
  if (!ok) return json(res, 403, { error: 'not allowed' });
  json(res, 200, { session: await newSession() });
}
