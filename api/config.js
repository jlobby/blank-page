import { json } from '../lib/util.js';

// GET /api/config -> which admin sign-in methods are set up (never the password or address)
export default function handler(req, res) {
  json(res, 200, {
    googleClientId: process.env.GOOGLE_CLIENT_ID || null,
    password: (process.env.ADMIN_PASSWORD || '').length >= 8,
  }, 'public, s-maxage=60');
}
