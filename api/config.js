import { json } from '../lib/util.js';

// GET /api/config -> public settings the page needs (never the admin address)
export default function handler(req, res) {
  json(res, 200, { googleClientId: process.env.GOOGLE_CLIENT_ID || null }, 'public, s-maxage=60');
}
