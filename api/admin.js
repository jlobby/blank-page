import { redis } from '../lib/store.js';
import { K, dayKey, json, body, ip, limit, append } from '../lib/util.js';
import { isAdmin } from '../lib/admin.js';

// POST /api/admin {session, sq, id?} -> removes one stroke/text (id) or the whole square
export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'POST only' });
  const b = body(req);
  if (!(await limit('admin', ip(req), 120, 60))) return json(res, 429, { error: 'slow down' });
  if (!(await isAdmin(b.session))) return json(res, 401, { error: 'sign in again' });
  if (typeof b.sq !== 'string' || !/^s[a-z0-9]{1,16}$/.test(b.sq)) return json(res, 400, { error: 'bad request' });
  const day = dayKey(), k = K(day);
  const who = await redis.hget(k.own, b.sq);
  if (!who) return json(res, 404, { error: 'no such drawing' });
  if (b.id != null) {
    if (typeof b.id !== 'string' || !/^[a-z0-9]{4,16}$/.test(b.id)) return json(res, 400, { error: 'bad request' });
    return json(res, 200, { ev: await append(day, { t: 'un', sq: b.sq, id: b.id }) });
  }
  await redis.hdel(k.own, b.sq);
  await redis.sadd(k.ban, who); // whoever made it cannot draw again today
  json(res, 200, { ev: await append(day, { t: 'del', sq: b.sq }) });
}
