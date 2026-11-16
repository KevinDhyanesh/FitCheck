import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { lookup } from 'node:dns/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { extractProduct, parseChart } from './extract.mjs';
import { scoreSizes } from './fit.mjs';

const root = fileURLToPath(new URL('./public/', import.meta.url));
function publicAddress(address) {
  if (address.includes(':')) return false; // IPv4-only fetch validation, including mapped-address protection.
  const p = address.split('.').map(Number);
  return !(p[0] === 0 || p[0] === 10 || p[0] === 127 || p[0] >= 224 || (p[0] === 169 && p[1] === 254) || (p[0] === 172 && p[1] >= 16 && p[1] <= 31) || (p[0] === 192 && p[1] === 168) || (p[0] === 100 && p[1] >= 64 && p[1] <= 127) || (p[0] === 198 && [18,19].includes(p[1])));
}
async function productPage(raw) {
  let url;
  try { url = new URL(raw); } catch { throw new Error('Enter a complete product URL, starting with https://.'); }
  for (let redirects = 0; redirects < 4; redirects++) {
    if (url.protocol !== 'https:' || url.username || url.password || (url.port && url.port !== '443')) throw new Error('Use a public HTTPS product link.');
    const addresses = await lookup(url.hostname, { all: true, family: 4 });
    if (!addresses.length || addresses.some(a => !publicAddress(a.address))) throw new Error('This address cannot be imported.');
    // Pin the approved DNS answer so a second lookup cannot target a private address.
    const result = await new Promise((resolve, reject) => {
      import('node:https').then(({get}) => {
        const req = get(url, { headers: { 'User-Agent': 'Fitcheck/1.0 personal size-chart reader', Accept: 'text/html' }, lookup: (_host, opts, cb) => opts.all ? cb(null, addresses) : cb(null, addresses[0].address, 4) }, res => {
          if ([301,302,303,307,308].includes(res.statusCode)) { res.resume(); resolve({ redirect: res.headers.location }); return; }
          if (res.statusCode !== 200) { res.resume(); reject(new Error('The store blocked access or the page is unavailable. Paste its size chart below.')); return; }
          if (!/text\/html/i.test(res.headers['content-type'] || '')) { res.resume(); reject(new Error('This link does not point to a product webpage.')); return; }
          let bytes = 0, chunks = [];
          res.on('data', c => { bytes += c.length; if (bytes > 3_000_000) req.destroy(new Error('This page is too large. Paste the size chart instead.')); else chunks.push(c); });
          res.on('end', () => resolve({ html: Buffer.concat(chunks).toString('utf8') }));
          res.on('error', reject);
        });
        const timer = setTimeout(() => req.destroy(new Error('The store took too long. Paste the size chart instead.')), 12000);
        req.on('close', () => clearTimeout(timer)); req.on('error', reject);
      }).catch(reject);
    });
    if (result.redirect) { url = new URL(result.redirect, url); continue; }
    return extractProduct(result.html, url.href);
  }
  throw new Error('Too many redirects. Use the final product link.');
}
export async function handleRequest(req, res) {
  const json = (code, data) => { res.writeHead(code, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(data)); };
  try {
    if (req.method === 'POST' && ['/api/import','/api/check','/api/parse'].includes(req.url)) {
      if (req.headers.origin && req.headers.origin !== `http://${req.headers.host}`) return json(403, { error: 'Cross-origin request rejected.' });
      let raw = ''; for await (const chunk of req) { raw += chunk; if (raw.length > 60000) return json(413, { error: 'Input is too large.' }); }
      const body = JSON.parse(raw);
      if (req.url === '/api/import') return json(200, await productPage(body.url));
      if (req.url === '/api/parse') return json(200, { chart: parseChart(body.text || '', body.unit) });
      if (!Array.isArray(body.chart) || body.chart.length > 30 || !body.profile || !['tops','bottoms'].includes(body.category) || !['garment','body'].includes(body.basis) || !['close','regular','relaxed'].includes(body.preference)) return json(400, { error: 'Check your measurements and chart settings.' });
      return json(200, { results: scoreSizes(body.profile, body.chart, body) });
    }
    if (req.method !== 'GET') return json(405, { error: 'Method not allowed' });
    const files = { '/brand-mark.svg': ['brand-mark.svg','image/svg+xml'], '/': ['index.html','text/html'], '/app.js': ['app.js','text/javascript'], '/style.css': ['style.css','text/css'] };
    const file = files[req.url?.split('?')[0]];
    if (!file) return json(404, { error: 'Not found' });
    res.writeHead(200, { 'Content-Type': `${file[1]}; charset=utf-8`, 'X-Content-Type-Options': 'nosniff' }); res.end(await readFile(root + file[0]));
  } catch (e) { json(400, { error: e.message || 'Something went wrong.' }); }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  http.createServer(handleRequest).listen(Number(process.env.PORT) || 3000, '127.0.0.1', () => console.log('Fitcheck is ready at http://localhost:3000'));
}
