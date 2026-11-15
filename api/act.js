import { redis } from '../lib/store.js';
import { K, S, dayKey, json, body, ip, owner, limit, append, cleanName } from '../lib/util.js';

const num = (x, lo, hi) => typeof x === 'number' && Number.isFinite(x) ? Math.min(hi, Math.max(lo, x)) : null;
const sid = x => typeof x === 'string' && /^[a-z0-9]{4,16}$/.test(x) ? x : null;

function clean(e) {
  if (!e || typeof e !== 'object') return null;
  const ink = Math.round(num(e.ink, 0, 4) ?? 0);
  switch (e.t) {
    case 'sq': {
      const x = num(e.x, -1e5, 1e5), y = num(e.y, -1e5, 1e5), r = num(e.r, -1e3, 1e3);
      return x == null || y == null || r == null ? null : { t: 'sq', x: Math.round(x), y: Math.round(y), r: +r.toFixed(3) };
    }
    case 'st': {
      if (!sid(e.id) || !Array.isArray(e.pts) || e.pts.length < 2 || e.pts.length > 3000 || e.pts.length % 2) return null;
      const pts = e.pts.map(p => num(p, -20, S + 20));
      if (pts.some(p => p == null)) return null;
      return { t: 'st', id: e.id, ink, w: num(e.w, 1, 14) ?? 3, pts: pts.map(p => Math.round(p * 10) / 10) };
    }
    case 'tx': case 'te': { // te = edit of an existing text, same fields
      const text = typeof e.text === 'string' ? e.text.trim().replace(/\n{3,}/g, '\n\n').slice(0, 600) : '';
      const x = num(e.x, 0, S), y = num(e.y, 0, S);
      if (!sid(e.id) || !text || x == null || y == null) return null;
      return { t: e.t, id: e.id, ink, size: num(e.size, 10, 60) ?? 20, x: Math.round(x), y: Math.round(y), text };
    }
    case 'un': return sid(e.id) ? { t: 'un', id: e.id } : null;
    case 'nm': { const name = cleanName(e.name); return name ? { t: 'nm', name } : null; }
    default: return null;
  }
}

// POST /api/act {token, sq, ev} -> appends one change to the caller's own square
export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'POST only' });
  const b = body(req), me = owner(b.token);
  if (!me) return json(res, 400, { error: 'bad token' });
  const day = dayKey(), k = K(day);
  if (b.day && b.day !== day) return json(res, 409, { error: 'new day' });
  if (typeof b.sq !== 'string' || (await redis.hget(k.own, b.sq)) !== me) return json(res, 403, { error: 'not your square' });
  if (!(await limit('act', ip(req), 300, 60))) return json(res, 429, { error: 'slow down' });
  const e = clean(b.ev);
  if (!e) return json(res, 400, { error: 'bad change' });
  const out = await append(day, { ...e, sq: b.sq });
  if (!out) return json(res, 507, { error: 'page is full for today' });
  json(res, 200, { ev: out });
}
