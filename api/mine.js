import { redis } from '../lib/store.js';
import { K, dayKey, dayBefore, json, body, ip, owner, limit } from '../lib/util.js';

// POST /api/mine {token, day, sqs:[...]} -> {views, replies} for your own creations, today or yesterday,
// so a returning visitor can see what happened to what they made.
export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'POST only' });
  const b = body(req), me = owner(b.token);
  if (!me || !Array.isArray(b.sqs)) return json(res, 400, { error: 'bad request' });
  if (!(await limit('mine', ip(req), 30, 60))) return json(res, 429, { error: 'slow down' });
  const today = dayKey(), day = b.day === dayBefore(today) ? b.day : today, k = K(day);
  const sqs = [...new Set(b.sqs.filter(s => typeof s === 'string' && /^s[a-z0-9]{1,16}$/.test(s)))].slice(0, 12);
  const rows = await Promise.all(sqs.map(async s => [s, await redis.hget(k.own, s), await redis.hget(k.vc, s), await redis.hget(k.rc, s)]));
  const views = {}, replies = {};
  for (const [s, who, v, r] of rows) if (who === me) { views[s] = +v || 0; replies[s] = +r || 0; }   // only your own
  json(res, 200, { day, views, replies });
}
