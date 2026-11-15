import { redis } from '../lib/store.js';
import { K, dayKey, json } from '../lib/util.js';

// Redis hashes may come back as an object or as a flat [field, value, ...] list.
const pairs = h => Array.isArray(h)
  ? Array.from({ length: h.length / 2 }, (_, i) => [h[2 * i], h[2 * i + 1]])
  : Object.entries(h || {});

// GET /api/views -> {day, counts:{sq:n}}
export default async function handler(req, res) {
  const day = dayKey();
  const counts = Object.fromEntries(pairs(await redis.hgetall(K(day).vc)).map(([s, n]) => [s, +n]));
  json(res, 200, { day, counts }, 'public, s-maxage=5, stale-while-revalidate=10');
}
