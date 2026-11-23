import { redis } from '../lib/store.js';
import { K, dayKey, dayBefore, json, pairs, interest } from '../lib/util.js';

// GET /api/yesterday -> yesterday's most interesting creation (views, with zoom-ins worth more), which survives one more day.
// {day, sq, name, views, items} or {day, sq:null}. Deleted or empty creations never win;
// a tie goes to the one made first. Yesterday's keys live 48 h, long enough for today.
export default async function handler(req, res) {
  const day = dayBefore(dayKey()), k = K(day);
  const [vcRaw, fcRaw] = await Promise.all([redis.hgetall(k.vc), redis.hgetall(k.fc)]);
  const focus = Object.fromEntries(pairs(fcRaw).map(([s, n]) => [s, +n]));
  const counts = pairs(vcRaw).map(([sq, n]) => [sq, +n]).filter(([, n]) => n > 0);
  const none = () => json(res, 200, { day, sq: null }, 'public, s-maxage=300, stale-while-revalidate=600');
  if (!counts.length) return none();

  // rebuild each creation from yesterday's events
  const sqs = new Map();
  for (const raw of await redis.zrange(k.ev, 1, '+inf', { byScore: true })) {
    const e = JSON.parse(raw), q = sqs.get(e.sq);
    if (e.t === 'sq') { if (!q) sqs.set(e.sq, { born: e.v, name: e.name || null, items: [] }); else if (e.name) q.name = e.name; continue; }
    if (!q) continue;
    if (e.t === 'del') { q.gone = true; continue; }
    if (e.t === 'nm') { q.name = e.name; continue; }
    if (e.t === 'un') { q.items = q.items.filter(i => i.id !== e.id); continue; }
    if (e.t === 'te') { const it = q.items.find(i => i.id === e.id); if (it) Object.assign(it, { ink: e.ink, size: e.size, x: e.x, y: e.y, text: e.text }); continue; }
    if (e.t === 'st' || e.t === 'tx') { const { v, sq, ...it } = e; q.items.push(it); }
  }
  const best = counts
    .map(([sq, n]) => ({ sq, n, score: interest(n, focus[sq]), q: sqs.get(sq) }))
    .filter(c => c.q && !c.q.gone && c.q.items.length)
    .sort((a, b) => b.score - a.score || a.q.born - b.q.born)[0];
  if (!best) return none();
  json(res, 200, { day, sq: best.sq, name: best.q.name, views: best.n, items: best.q.items },
    'public, s-maxage=300, stale-while-revalidate=600');
}
