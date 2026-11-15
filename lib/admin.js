import { randomBytes } from 'node:crypto';
import { redis } from './store.js';

const SESSION_TTL = 60 * 60 * 12; // 12 hours

// Checks a Google sign-in credential. The admin address lives only in the
// ADMIN_EMAIL environment variable and is never sent to the browser.
export async function verifyGoogle(credential) {
  if (process.env.BLANK_DEV && !process.env.VERCEL && credential === 'dev') return true; // local preview only
  const clientId = process.env.GOOGLE_CLIENT_ID, admin = process.env.ADMIN_EMAIL;
  if (!clientId || !admin || typeof credential !== 'string' || credential.length > 4096) return false;
  const r = await fetch('https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(credential));
  if (!r.ok) return false;
  const t = await r.json();
  return t.aud === clientId
    && (t.iss === 'accounts.google.com' || t.iss === 'https://accounts.google.com')
    && String(t.email_verified) === 'true'
    && +t.exp * 1000 > Date.now()
    && String(t.email || '').toLowerCase() === admin.trim().toLowerCase();
}

export async function newSession() {
  const s = randomBytes(24).toString('base64url');
  await redis.set('admin:sess:' + s, '1', { ex: SESSION_TTL });
  return s;
}

export async function isAdmin(session) {
  if (typeof session !== 'string' || !/^[A-Za-z0-9_-]{32}$/.test(session)) return false;
  return (await redis.get('admin:sess:' + session)) === '1';
}
