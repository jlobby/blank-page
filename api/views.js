import { redis } from '../lib/store.js';
import { K, dayKey, json } from '../lib/util.js';

// GET /api/views -> {day, counts:{sq:n}}
export default async function handler(req, res) {
  const day = dayKey();
  const all = (await redis.hgetall(K(day).vc)) || {};
  const counts = Object.fromEntries(Object.entries(all).map(([s, n]) => [s, +n]));
  json(res, 200, { day, counts }, 'public, s-maxage=5, stale-while-revalidate=10');
}
