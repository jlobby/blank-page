import { redis } from '../lib/store.js';
import { K, dayKey, json, pairs, FOCUS_WEIGHT } from '../lib/util.js';

const asCounts = h => Object.fromEntries(pairs(h).map(([s, n]) => [s, +n]));

// GET /api/views -> {day, counts:{sq: people who saw it}, focus:{sq: people who zoomed in}, weight}
export default async function handler(req, res) {
  const day = dayKey(), k = K(day);
  const [vc, fc] = await Promise.all([redis.hgetall(k.vc), redis.hgetall(k.fc)]);
  json(res, 200, { day, counts: asCounts(vc), focus: asCounts(fc), weight: FOCUS_WEIGHT },
    'public, s-maxage=5, stale-while-revalidate=10');
}
