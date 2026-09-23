/* ==========================================================================
   service-worker.js — offline support for the FlowMaster PWA
   Strategy:
     • App shell (HTML/CSS/JS/icons/manifest) is precached on install.
     • Same-origin GET requests: cache-first, falling back to network, and
       network responses are added to the runtime cache for next time.
     • Navigations fall back to the cached index.html when offline (SPA).
   Bump CACHE_VERSION whenever shell files change to roll the cache.
   ========================================================================== */

const CACHE_VERSION = 'flowmaster-v2';
const SHELL = [
  'index.html',
  'manifest.json',
  'css/styles.css',
  'js/data/pricebook.js',
  'js/components.js',
  'js/db.js',
  'js/router.js',
  'js/shared.js',
  'js/vendor/jspdf.umd.min.js',
  'js/vendor/jspdf.autotable.min.js',
  'js/pdf.js',
  'js/app.js',
  'js/views/dashboard.js',
  'js/views/customers.js',
  'js/views/pricebook.js',
  'js/views/invoices.js',
  'js/views/estimates.js',
  'js/views/calendar.js',
  'js/views/financials.js',
  'js/views/receipts.js',
  'js/views/reports.js',
  'js/views/emails.js',
  'js/views/settings.js',
  'js/views/placeholders.js',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-512.png',
  'icons/apple-touch-icon.png',
  'icons/favicon-32.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;        // don't touch cross-origin

  // SPA navigations: try network, fall back to cached index.html
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).catch(() => caches.match('index.html'))
    );
    return;
  }

  // Static assets: cache-first, then network (and cache it)
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((res) => {
        if (res && res.status === 200 && res.type === 'basic') {
          const copy = res.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put(req, copy));
        }
        return res;
      }).catch(() => cached);
    })
  );
});
