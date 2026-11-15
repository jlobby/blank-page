import { redis } from '../lib/store.js';
import { K, dayKey, json, body, ip, owner, limit, append } from '../lib/util.js';

// POST /api/claim {token} -> {day, sq}: today's square for this browser, created if needed
export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'POST only' });
  const me = owner(body(req).token);
  if (!me) return json(res, 400, { error: 'bad token' });
  const day = dayKey(), k = K(day);
  const have = await redis.hget(k.who, me);
  if (have) return json(res, 200, { day, sq: have });
  if (!(await limit('claim', ip(req), 20, 86400))) return json(res, 429, { error: 'too many squares from this network today' });

  const n = await redis.incr(k.n);
  const sq = 's' + n.toString(36) + Math.random().toString(36).slice(2, 5);
  const a = n * 2.39996, rad = n === 1 ? 0 : 300 * Math.sqrt(n);
  const ev = await append(day, {
    t: 'sq', sq,
    x: Math.round(Math.cos(a) * rad), y: Math.round(Math.sin(a) * rad),
    r: +((Math.random() - 0.5) * 0.3).toFixed(3),
  });
  if (!ev) return json(res, 507, { error: 'page is full for today' });
  await Promise.all([redis.hset(k.who, { [me]: sq }), redis.hset(k.own, { [sq]: me })]);
  json(res, 200, { day, sq, ev });
}
