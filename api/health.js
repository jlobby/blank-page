// GET /api/health -> whether storage is configured (names only, never values)
export default async function handler(req, res) {
  const has = n => !!process.env[n];
  const out = {
    node: process.version,
    redisUrl: has('KV_REST_API_URL') || has('UPSTASH_REDIS_REST_URL'),
    redisToken: has('KV_REST_API_TOKEN') || has('UPSTASH_REDIS_REST_TOKEN'),
    adminKey: has('ADMIN_KEY'),
    redisEnvNames: Object.keys(process.env).filter(k => /REDIS|KV_|UPSTASH/.test(k)),
  };
  try {
    const { redis } = await import('../lib/store.js');
    out.ping = await redis.incr('bp:health');
  } catch (e) { out.error = String(e && e.message || e); }
  res.setHeader('Content-Type', 'application/json'); res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(out));
}
