/* ==========================================================================
   app.js — application bootstrap & shell
   Builds the navigation shell, manages theme + online/offline state, registers
   the service worker, handles the PWA install prompt, then starts the router.
   ========================================================================== */

(function () {
  const { el } = UI;

  // Full navigation set (order = sidebar order). `primary:true` => bottom tab bar.
  const NAV = [
    { route: 'dashboard',  label: 'Dashboard',  icon: 'dashboard',  primary: true },
    { route: 'invoices',   label: 'Invoices',   icon: 'invoice',    primary: true },
    { route: 'estimates',  label: 'Estimates',  icon: 'estimate' },
    { route: 'customers',  label: 'Customers',  icon: 'customers',  primary: true },
    { route: 'calendar',   label: 'Calendar',   icon: 'calendar',   primary: true },
    { route: 'financials', label: 'Financials', icon: 'financials' },
    { route: 'receipts',   label: 'Receipts',   icon: 'receipt' },
    { route: 'pricebook',  label: 'Price Book', icon: 'pricebook' },
    { route: 'emails',     label: 'Email Center', icon: 'email' },
    { route: 'reports',    label: 'Reports',    icon: 'reports' },
    { route: 'settings',   label: 'Settings',   icon: 'settings' },
  ];

  let deferredInstall = null;   // captured beforeinstallprompt event

  /* ---- theme ------------------------------------------------------------ */
  function applyTheme(mode) {
    const root = document.documentElement;
    const resolved = mode === 'system'
      ? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
      : mode;
    root.setAttribute('data-theme', resolved);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', resolved === 'dark' ? '#161d27' : '#0f62b8');
    // refresh toggle icon
    document.querySelectorAll('[data-theme-toggle]').forEach(btn => {
      UI.clear(btn).appendChild(UI.icon(resolved === 'dark' ? 'sun' : 'moon'));
    });
  }
  // Exposed so other views (e.g. Settings) can re-apply the theme after saving.
  window.applyTheme = applyTheme;

  async function toggleTheme() {
    const s = await DB.settings();
    const resolved = document.documentElement.getAttribute('data-theme');
    const next = resolved === 'dark' ? 'light' : 'dark';
    await DB.saveSettings({ theme: next });
    applyTheme(next);
  }

  /* ---- shell construction ---------------------------------------------- */
  function buildShell(settings) {
    const app = document.getElementById('app');
    UI.clear(app);

    const brandName = settings.businessName || 'FlowMaster';
    const brandShort = brandName.split(' ')[0];

    // Sidebar (desktop)
    const navLinks = (sheet = false) => NAV.map(item =>
      el('button.nav-link', { dataset: { route: item.route },
        onClick: () => { Router.go(item.route); if (sheet) closeSheet(); } },
        [UI.icon(item.icon), el('span', { text: item.label })]));

    const sidebar = el('aside.sidebar', [
      el('div.sidebar-brand', [
        el('img', { src: 'icons/icon-192.png', alt: '' }),
        el('div.name', { html: `${esc(brandShort)}<span>${esc(brandName.slice(brandShort.length))}</span>` }),
      ]),
      el('nav.nav', navLinks(false)),
    ]);

    // Top bar
    const topbar = el('header.topbar', [
      el('div.brand-mobile.mobile-only', [
        el('img', { src: 'icons/icon-192.png', alt: '' }),
        el('div', { html: `${esc(brandShort)}<span>${esc(brandName.slice(brandShort.length))}</span>` }),
      ]),
      el('div.page-title.desktop-only', { text: 'Dashboard' }),
      el('div.spacer'),
      el('button.icon-btn', { 'aria-label': 'Toggle theme', dataset: { themeToggle: '1' },
        onClick: toggleTheme }, [UI.icon('moon')]),
      el('button.icon-btn', { 'aria-label': 'Notifications', onClick: () =>
        UI.toast('Reminders arrive with the Scheduling module', 'ok') }, [UI.icon('bell')]),
    ]);

    // Content outlet
    const content = el('main.content', [
      el('div#offline-banner'),
      el('div#install-banner'),
      el('div#outlet'),
    ]);

    const main = el('div.main', [topbar, content]);

    // Bottom tab bar (mobile)
    const primaries = NAV.filter(n => n.primary);
    const bottomnav = el('nav.bottomnav.mobile-only',
      primaries.map(item => el('button.tab', { dataset: { route: item.route },
        onClick: () => Router.go(item.route) },
        [UI.icon(item.icon), el('span', { text: item.label })]))
      .concat([ el('button.tab', { dataset: { more: '1' }, onClick: openSheet },
        [UI.icon('more'), el('span', { text: 'More' })]) ]));

    // "More" sheet
    const sheet = el('div.sheet', [
      el('div.sheet-grab'),
      el('nav.nav', navLinks(true)),
    ]);
    const sheetBackdrop = el('div.sheet-backdrop', { onClick: closeSheet });
    document.body.appendChild(sheetBackdrop);
    document.body.appendChild(sheet);

    app.appendChild(el('div.app-shell', [sidebar, main, bottomnav]));
  }

  function openSheet() {
    document.querySelector('.sheet-backdrop')?.classList.add('open');
    document.querySelector('.sheet')?.classList.add('open');
    document.querySelector('.tab[data-more]')?.classList.add('more-open');
  }
  function closeSheet() {
    document.querySelector('.sheet-backdrop')?.classList.remove('open');
    document.querySelector('.sheet')?.classList.remove('open');
    document.querySelector('.tab[data-more]')?.classList.remove('more-open');
  }

  /* ---- nav highlight sync ---------------------------------------------- */
  function syncNav(name) {
    document.querySelectorAll('[data-route]').forEach(node => {
      node.classList.toggle('active', node.dataset.route === name);
    });
    // bottom tabs: highlight "More" if active route isn't a primary tab
    const primaries = NAV.filter(n => n.primary).map(n => n.route);
    const moreTab = document.querySelector('.tab[data-more]');
    if (moreTab) moreTab.classList.toggle('active', !primaries.includes(name));
  }

  /* ---- online / offline ------------------------------------------------- */
  function renderOffline() {
    const host = document.getElementById('offline-banner');
    if (!host) return;
    UI.clear(host);
    if (!navigator.onLine) {
      host.appendChild(el('div.banner.warn', [
        UI.icon('wifi_off'),
        el('span', { text: "You're offline — changes are saved on this device and stay available." }),
      ]));
    }
  }

  /* ---- install prompt --------------------------------------------------- */
  function renderInstall() {
    const host = document.getElementById('install-banner');
    if (!host || !deferredInstall) return;
    UI.clear(host);
    host.appendChild(el('div.banner.info', [
      UI.icon('download'),
      el('span', { text: 'Install FlowMaster for full-screen, offline access.' }),
      el('div.spacer'),
      el('button', { onClick: async () => {
        host.innerHTML = ''; deferredInstall.prompt();
        await deferredInstall.userChoice; deferredInstall = null;
      } }, 'Install'),
      el('button', { onClick: () => { host.innerHTML = ''; }, style: 'opacity:.7' }, 'Not now'),
    ]));
  }

  /* ---- service worker --------------------------------------------------- */
  function registerSW() {
    if (!('serviceWorker' in navigator)) return;
    // Only over http(s); file:// can't host a service worker.
    if (location.protocol === 'file:') {
      console.info('[SW] Skipped (file://). Serve over http://localhost for offline mode.');
      return;
    }
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('service-worker.js')
        .then(() => console.info('[SW] registered'))
        .catch(err => console.warn('[SW] registration failed:', err));
    });
  }

  function esc(s = '') { return String(s).replace(/[&<>"]/g,
    c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

  /* ---- boot ------------------------------------------------------------- */
  async function boot() {
    await DB.ready();
    const settings = await DB.settings();
    applyTheme(settings.theme || 'system');
    buildShell(settings);

    Router.onChange((name) => { syncNav(name); });
    Router.start();

    renderOffline();
    window.addEventListener('online', () => { renderOffline(); UI.toast('Back online'); });
    window.addEventListener('offline', renderOffline);

    matchMedia('(prefers-color-scheme: dark)').addEventListener('change', async () => {
      const s = await DB.settings(); if ((s.theme || 'system') === 'system') applyTheme('system');
    });

    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault(); deferredInstall = e; renderInstall();
    });

    registerSW();
  }

  document.addEventListener('DOMContentLoaded', boot);
})();
