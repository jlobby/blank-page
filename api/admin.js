import { redis } from '../lib/store.js';
import { K, dayKey, json, body, ip, limit, append, safeEq } from '../lib/util.js';

// POST /api/admin {key, sq} -> removes a square for everyone
export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'POST only' });
  const b = body(req), key = process.env.ADMIN_KEY;
  if (!(await limit('admin', ip(req), 30, 300))) return json(res, 429, { error: 'slow down' });
  if (!key || !safeEq(b.key || '', key)) return json(res, 401, { error: 'wrong key' });
  if (typeof b.sq !== 'string') return json(res, 400, { error: 'bad request' });
  const day = dayKey(), k = K(day);
  const who = await redis.hget(k.own, b.sq);
  if (!who) return json(res, 404, { error: 'no such square' });
  await redis.hdel(k.own, b.sq);
  const ev = await append(day, { t: 'del', sq: b.sq });
  json(res, 200, { ev });
}
