import { redis } from '../lib/store.js';
import { K, dayKey, json, body, ip, owner, limit } from '../lib/util.js';

const ids = list => Array.isArray(list) ? [...new Set(list.filter(s => typeof s === 'string' && /^s[a-z0-9]{1,16}$/.test(s)))].slice(0, 40) : [];

// POST /api/view {token, sqs:[...], focus:[...]} -> one view per person per creation per day;
// focus = creations this person zoomed in on (also counted as seen)
export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'POST only' });
  const b = body(req), me = owner(b.token);
  if (!me || (!Array.isArray(b.sqs) && !Array.isArray(b.focus))) return json(res, 400, { error: 'bad request' });
  if (!(await limit('view', ip(req), 60, 60))) return json(res, 429, { error: 'slow down' });
  const day = dayKey(), k = K(day);
  const focusIn = ids(b.focus), seenIn = [...new Set([...ids(b.sqs), ...focusIn])];
  const owners = new Map(await Promise.all(seenIn.map(async s => [s, await redis.hget(k.own, s)])));
  const ok = s => owners.get(s) && owners.get(s) !== me;          // never count your own
  const seen = seenIn.filter(ok), focus = focusIn.filter(ok);
  const added = await Promise.all(seen.map(s => redis.sadd(k.vw(s), me)));
  await Promise.all(seen.filter((_, i) => added[i] === 1).map(s => redis.hincrby(k.vc, s, 1)));
  const zoomed = await Promise.all(focus.map(s => redis.sadd(k.vf(s), me)));
  await Promise.all(focus.filter((_, i) => zoomed[i] === 1).map(s => redis.hincrby(k.fc, s, 1)));
  await Promise.all([...seen.map(s => redis.expire(k.vw(s), 172800)), ...focus.map(s => redis.expire(k.vf(s), 172800)),
    redis.expire(k.vc, 172800), redis.expire(k.fc, 172800)]);
  json(res, 200, { ok: true });
}
