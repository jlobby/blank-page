import { redis } from '../lib/store.js';
import { json, body, ip, owner, limit } from '../lib/util.js';

const KEY = 'bp:here', WINDOW = 45 * 1000; // someone counts as here if they checked in during the last 45 s

// POST /api/here {token} -> check in.  GET /api/here -> {n}: people on the page now
export default async function handler(req, res) {
  if (req.method === 'POST') {
    const me = owner(body(req).token);
    if (!me) return json(res, 400, { error: 'bad token' });
    if (!(await limit('here', ip(req), 30, 60))) return json(res, 429, { error: 'slow down' });
    await redis.zadd(KEY, { score: Date.now(), member: me });
    return json(res, 200, { ok: true });
  }
  await redis.zremrangebyscore(KEY, 0, Date.now() - WINDOW);
  json(res, 200, { n: await redis.zcard(KEY) }, 'public, s-maxage=10, stale-while-revalidate=20');
}
