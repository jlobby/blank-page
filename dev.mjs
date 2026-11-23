// Local preview: node dev.mjs  (uses an in-memory store unless Upstash env vars are set)
import http from 'node:http';
import { readFile } from 'node:fs/promises';
process.env.BLANK_DEV ||= '1';
const routes = {};
for (const n of ['events', 'claim', 'act', 'view', 'views', 'admin', 'admin-login', 'config', 'here', 'yesterday']) routes['/api/' + n] = (await import(`./api/${n}.js`)).default;
http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://x');
  const h = routes[u.pathname];
  if (u.pathname === '/__dev/day') { process.env.BLANK_FAKE_DAY = u.searchParams.get('d') || ''; return res.end('ok'); } // pretend it is another day
  if (!h && u.pathname.startsWith('/_vercel/')) { res.statusCode = 404; return res.end(); } // analytics exist only on Vercel
  if (!h) {
    const file = u.pathname.slice(1);
    if (/^[\w.-]+\.(png|svg|txt|xml)$/.test(file)) { try { const ext = file.split('.').pop(); res.setHeader('content-type', { png: 'image/png', svg: 'image/svg+xml', txt: 'text/plain', xml: 'application/xml' }[ext]); return res.end(await readFile(file)); } catch { res.statusCode = 404; return res.end(); } }
    res.setHeader('content-type', 'text/html; charset=utf-8'); return res.end(await readFile('index.html'));
  }
  req.query = Object.fromEntries(u.searchParams);
  let raw = ''; for await (const c of req) raw += c; req.body = raw;
  try { await h(req, res); } catch (e) { console.error(e); res.statusCode = 500; res.end('{}'); }
}).listen(process.env.PORT || 3000, () => console.log('http://localhost:' + (process.env.PORT || 3000)));
