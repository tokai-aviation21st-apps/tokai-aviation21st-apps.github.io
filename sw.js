/* Offline copy of this site. Only runs for people who turned it on in Settings (トップページ → 設定).
   The saved pages are the same encrypted pages as on the server; nothing is decrypted or stored in plain text here.
   Saved pages: open online → the newest version is fetched and the saved copy is replaced. Offline → the saved copy is shown. */
const CACHE = 'site-offline-v1';
const LIB = '/89af15/';
const WAIT_MS = 6000;   // on a very slow connection, show the saved copy after this and keep updating in the background

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));

function keyOf(url) { const u = new URL(url); return u.origin + u.pathname.replace(/index\.html$/, ''); }

function offlinePage() {
  return new Response('<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex, nofollow">'
    + '<title>オフライン</title><body style="font:15px/1.7 system-ui,-apple-system,sans-serif;margin:0;padding:40px 16px;background:#f2f1f4;color:#1d2233">'
    + '<p style="max-width:420px;margin:0 auto">ネットにつながっていません。このページはこの端末に保存されていないため、開けません。</p>',
    { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}

self.addEventListener('fetch', e => {
  const r = e.request;
  if (r.method !== 'GET') return;
  const u = new URL(r.url);
  if (u.origin !== self.location.origin) return;              // fonts, analytics, etc.: untouched
  if (u.pathname === '/sw.js') return;
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const key = keyOf(r.url);
    const saved = await cache.match(key);
    if (!saved) {                                               // not saved on this device: behave as usual
      try { return await fetch(r); }
      catch (err) { if (r.mode === 'navigate') return offlinePage(); throw err; }
    }
    if (u.pathname.startsWith(LIB)) return saved;               // libraries: the saved copy (renewed from Settings)
    const net = fetch(u.href, { cache: 'no-store', credentials: 'same-origin' }).then(res => {
      if (res.ok && res.type === 'basic' && !res.redirected) return cache.put(key, res.clone()).then(() => res);
      return res;
    });
    e.waitUntil(net.catch(() => {}));
    try {
      const res = await Promise.race([net, new Promise((_, no) => setTimeout(() => no(new Error('slow')), WAIT_MS))]);
      return (res.ok && !res.redirected) ? res : saved;
    } catch (err) { return saved; }
  })());
});
