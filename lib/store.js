import { Redis } from '@upstash/redis';

const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

export const redis = url
  ? new Redis({ url, token, automaticDeserialization: false })
  : process.env.BLANK_DEV ? memory() : missing();

function missing() {
  return new Proxy({}, { get() { return async () => { throw new Error('Redis is not connected: add Upstash Redis to the Vercel project'); }; } });
}

// In-memory stand-in for local development only.
function memory() {
  const kv = new Map(), z = new Map(), h = new Map(), s = new Map();
  const hash = k => (h.has(k) || h.set(k, new Map()), h.get(k));
  return {
    async get(k) { return kv.has(k) ? String(kv.get(k)) : null; },
    async incr(k) { const n = (+kv.get(k) || 0) + 1; kv.set(k, n); return n; },
    async expire() { return 1; },
    async zadd(k, { score, member }) { (z.get(k) || z.set(k, []).get(k)).push([score, member]); return 1; },
    async zrange(k, min, max) {
      const lo = +min, hi = max === '+inf' ? Infinity : +max;
      return (z.get(k) || []).filter(([sc]) => sc >= lo && sc <= hi).sort((a, b) => a[0] - b[0]).map(x => x[1]);
    },
    async hget(k, f) { const v = hash(k).get(f); return v == null ? null : String(v); },
    async hset(k, o) { for (const [f, v] of Object.entries(o)) hash(k).set(f, v); return 1; },
    async hdel(k, f) { return hash(k).delete(f) ? 1 : 0; },
    async hgetall(k) { const m = hash(k); return m.size ? Object.fromEntries(m) : null; },
    async hincrby(k, f, n) { const v = (+hash(k).get(f) || 0) + n; hash(k).set(f, v); return v; },
    async sadd(k, m) { const st = s.get(k) || s.set(k, new Set()).get(k); if (st.has(m)) return 0; st.add(m); return 1; },
  };
}
