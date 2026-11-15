import { createHash, timingSafeEqual } from 'node:crypto';
import { redis } from './store.js';

export const S = 360;            // square side, world units
export const TTL = 60 * 60 * 48; // keys outlive their day, then Redis drops them
export const MAX_EVENTS = 60000; // per day

const TZ = 'Asia/Jerusalem';
export const dayKey = () =>
  new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());

export const K = day => ({
  v: `bp:${day}:v`,       // event counter
  n: `bp:${day}:n`,       // square counter
  ev: `bp:${day}:ev`,     // zset of events, score = v
  who: `bp:${day}:who`,   // owner hash -> square id
  own: `bp:${day}:own`,   // square id -> owner hash
  vc: `bp:${day}:vc`,     // square id -> view count
  vw: sq => `bp:${day}:vw:${sq}`, // set of viewers of a square
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

export const safeEq = (a, b) => {
  const x = Buffer.from(String(a)), y = Buffer.from(String(b));
  return x.length === y.length && timingSafeEqual(x, y);
};
