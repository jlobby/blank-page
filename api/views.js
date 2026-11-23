import { redis } from '../lib/store.js';
import { K, dayKey, json, pairs } from '../lib/util.js';

// GET /api/views -> {day, counts:{sq:n}}
export default async function handler(req, res) {
  const day = dayKey();
  const counts = Object.fromEntries(pairs(await redis.hgetall(K(day).vc)).map(([s, n]) => [s, +n]));
  json(res, 200, { day, counts }, 'public, s-maxage=5, stale-while-revalidate=10');
}
