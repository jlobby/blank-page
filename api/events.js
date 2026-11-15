import { redis } from '../lib/store.js';
import { K, dayKey, json } from '../lib/util.js';

// GET /api/events?day=YYYY-MM-DD&since=N  -> events after N for today
export default async function handler(req, res) {
  const day = dayKey(), k = K(day);
  const q = req.query || {};
  const reset = q.day !== day;
  const since = reset ? 0 : Math.max(0, parseInt(q.since, 10) || 0);
  const [v, raw] = await Promise.all([redis.get(k.v), redis.zrange(k.ev, since + 1, '+inf', { byScore: true })]);
  json(res, 200, { day, v: +v || 0, reset, events: raw.map(r => JSON.parse(r)) },
    'public, s-maxage=1, stale-while-revalidate=2');
}
