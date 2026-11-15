import { redis } from '../lib/store.js';
import { K, dayKey, json, body, ip, owner, limit } from '../lib/util.js';

// POST /api/view {token, sqs:[...]} -> counts one view per viewer per square per day
export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'POST only' });
  const b = body(req), me = owner(b.token);
  if (!me || !Array.isArray(b.sqs)) return json(res, 400, { error: 'bad request' });
  if (!(await limit('view', ip(req), 60, 60))) return json(res, 429, { error: 'slow down' });
  const day = dayKey(), k = K(day);
  const mine = await redis.hget(k.who, me);
  const sqs = [...new Set(b.sqs.filter(s => typeof s === 'string' && /^s[a-z0-9]{1,16}$/.test(s) && s !== mine))].slice(0, 40);
  const added = await Promise.all(sqs.map(s => redis.sadd(k.vw(s), me)));
  await Promise.all(sqs.filter((_, i) => added[i] === 1).map(s => redis.hincrby(k.vc, s, 1)));
  await Promise.all(sqs.map(s => redis.expire(k.vw(s), 172800)).concat(redis.expire(k.vc, 172800)));
  json(res, 200, { ok: true });
}
