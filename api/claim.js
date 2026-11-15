import { redis } from '../lib/store.js';
import { K, dayKey, json, body, ip, owner, limit, append, cleanName, MAX_SQUARES } from '../lib/util.js';

// POST /api/claim {token, x?, y?, name?} -> {day, sq, ev}: a new square where the person touched
export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'POST only' });
  const b = body(req), me = owner(b.token);
  if (!me) return json(res, 400, { error: 'bad token' });
  const day = dayKey(), k = K(day);
  if (await redis.sismember(k.ban, me)) return json(res, 403, { error: 'blocked today' });
  if (!(await limit('claim', ip(req), 60, 86400))) return json(res, 429, { error: 'too many from this network today' });
  const mineToday = await redis.hincrby(k.cnt, me, 1);
  if (mineToday > MAX_SQUARES) { await redis.hincrby(k.cnt, me, -1); return json(res, 429, { error: 'limit', max: MAX_SQUARES }); }

  const n = await redis.incr(k.n);
  const sq = 's' + n.toString(36) + Math.random().toString(36).slice(2, 5);
  const at = v => typeof v === 'number' && Number.isFinite(v) ? Math.round(Math.max(-1e5, Math.min(1e5, v))) : null;
  let x = at(b.x), y = at(b.y);
  if (x == null || y == null) { // no touch point given: next spot on a spiral around the center
    const a = n * 2.39996, rad = n === 1 ? 0 : 300 * Math.sqrt(n);
    x = Math.round(Math.cos(a) * rad); y = Math.round(Math.sin(a) * rad);
  }
  const name = cleanName(b.name);
  const ev = await append(day, { t: 'sq', sq, x, y, r: 0, ...(name ? { name } : {}) });
  if (!ev) return json(res, 507, { error: 'page is full for today' });
  await redis.hset(k.own, { [sq]: me });
  json(res, 200, { day, sq, ev });
}
