import { createHash } from 'node:crypto';
import { redis } from './store.js';

export const S = 360;            // square side, world units
export const TTL = 60 * 60 * 48; // keys outlive their day, then Redis drops them
export const MAX_EVENTS = 60000; // per day
export const MAX_SQUARES = 10;   // creations per person per day
export const FOCUS_WEIGHT = 5;   // a zoom-in shows more interest than a glance: worth 5 in a creation's interest score
// interest = people who saw it + (FOCUS_WEIGHT - 1) * people who zoomed in (zooming in also counts as seeing)
export const interest = (views, focus) => (views || 0) + (FOCUS_WEIGHT - 1) * (focus || 0);

const TZ = 'Asia/Jerusalem';
export const dayKey = () =>
  (process.env.BLANK_DEV && !process.env.VERCEL && process.env.BLANK_FAKE_DAY) // local testing only
  || new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());

export const dayBefore = day => { const d = new Date(day + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() - 1); return d.toISOString().slice(0, 10); };

// Redis hashes may come back as an object or as a flat [field, value, ...] list.
export const pairs = h => Array.isArray(h)
  ? Array.from({ length: h.length / 2 }, (_, i) => [h[2 * i], h[2 * i + 1]])
  : Object.entries(h || {});

export const K = day => ({
  v: `bp:${day}:v`,       // event counter
  n: `bp:${day}:n`,       // square counter
  ev: `bp:${day}:ev`,     // zset of events, score = v
  who: `bp:${day}:who`,   // owner hash -> square id
  own: `bp:${day}:own`,   // square id -> owner hash
  vc: `bp:${day}:vc`,     // square id -> view count
  vw: sq => `bp:${day}:vw:${sq}`, // set of viewers of a square
  vf: sq => `bp:${day}:vf:${sq}`, // set of people who zoomed in on a square
  fc: `bp:${day}:fc`,     // square id -> zoom-in count
  rc: `bp:${day}:rc`,     // square id -> replies it got
  cnt: `bp:${day}:cnt`,   // owner hash -> squares made today
  ban: `bp:${day}:ban`,   // owners blocked for the day by the admin
});

export const json = (res, code, body, cache) => {
  res.statusCode = code;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', cache || 'no-store');
  res.end(JSON.stringify(body));
};

export const body = req => {
  const b = req.body;
  if (b && typeof b === 'object') return b;
  try { return JSON.parse(b || '{}'); } catch { return {}; }
};

export const ip = req => String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '?').split(',')[0].trim();

export const owner = token =>
  typeof token === 'string' && /^[A-Za-z0-9_-]{16,64}$/.test(token)
    ? createHash('sha256').update('bp:' + token).digest('base64url').slice(0, 22)
    : null;

export async function limit(name, who, max, windowSec) {
  const key = `rl:${name}:${who}:${Math.floor(Date.now() / 1000 / windowSec)}`;
  const n = await redis.incr(key);
  if (n === 1) await redis.expire(key, windowSec + 5);
  return n <= max;
}

export async function append(day, ev) {
  const k = K(day);
  const v = await redis.incr(k.v);
  if (v > MAX_EVENTS) return null;
  const e = { ...ev, v };
  if (e.t === 'sq') e.z = v;
  await redis.zadd(k.ev, { score: v, member: JSON.stringify(e) });
  if (v === 1 || v % 50 === 0) await Promise.all(Object.values(k).filter(x => typeof x === 'string').map(x => redis.expire(x, TTL)));
  return e;
}

export const cleanName = n => {
  if (typeof n !== 'string') return null;
  const t = n.replace(/[\u0000-\u001f\u007f\u200b-\u200f\u202a-\u202e\u2066-\u2069]/g, '').replace(/\s+/g, ' ').trim().slice(0, 24);
  return t || null;
};

