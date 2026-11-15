// Local preview: node dev.mjs  (uses an in-memory store unless Upstash env vars are set)
import http from 'node:http';
import { readFile } from 'node:fs/promises';
process.env.BLANK_DEV ||= '1';
process.env.ADMIN_KEY ||= 'dev';
const routes = {};
for (const n of ['events', 'claim', 'act', 'view', 'views', 'admin']) routes['/api/' + n] = (await import(`./api/${n}.js`)).default;
http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://x');
  const h = routes[u.pathname];
  if (!h) { res.setHeader('content-type', 'text/html; charset=utf-8'); return res.end(await readFile('index.html')); }
  req.query = Object.fromEntries(u.searchParams);
  let raw = ''; for await (const c of req) raw += c; req.body = raw;
  try { await h(req, res); } catch (e) { console.error(e); res.statusCode = 500; res.end('{}'); }
}).listen(process.env.PORT || 3000, () => console.log('http://localhost:' + (process.env.PORT || 3000)));
