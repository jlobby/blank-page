import { redis } from '../lib/store.js';
import { K, dayKey, dayBefore, json, body, ip, limit } from '../lib/util.js';
import { isAdmin } from '../lib/admin.js';

// POST /api/admin-day {session} -> {day, events}: all of yesterday's events, for the admin's picture of the page
export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'POST only' });
  if (!(await limit('adminday', ip(req), 10, 300))) return json(res, 429, { error: 'slow down' });
  if (!(await isAdmin(body(req).session))) return json(res, 401, { error: 'sign in again' });
  const day = dayBefore(dayKey());
  const raw = await redis.zrange(K(day).ev, 1, '+inf', { byScore: true });
  json(res, 200, { day, events: raw.map(r => JSON.parse(r)) });
}
