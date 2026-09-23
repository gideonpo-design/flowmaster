/* ==========================================================================
   components.js — Reusable UI kit (no dependencies, works offline)
   Exposes a global `UI` with DOM helpers, an inline icon set, toasts, modals,
   formatters, and shared status maps. Every module builds its screens from
   these primitives so the look stays consistent.
   ========================================================================== */

const UI = (() => {

  /* ---- el(): tiny hyperscript DOM builder ------------------------------- */
  // el('div.card#x', { onclick }, [children]) -> HTMLElement
  function el(spec, props = {}, children = []) {
    const m = spec.match(/^([a-z0-9]+)?(#[\w-]+)?((?:\.[\w-]+)*)$/i) || [];
    const tag = m[1] || 'div';
    const node = document.createElement(tag);
    if (m[2]) node.id = m[2].slice(1);
    if (m[3]) node.className = m[3].split('.').filter(Boolean).join(' ');
    if (Array.isArray(props)) { children = props; props = {}; }
    else if (typeof props === 'string' || typeof props === 'number' || props instanceof Node) { children = props; props = {}; }
    for (const [k, v] of Object.entries(props || {})) {
      if (v == null || v === false) continue;
      if (k === 'class') node.className = (node.className + ' ' + v).trim();
      else if (k === 'html') node.innerHTML = v;
      else if (k === 'text') node.textContent = v;
      else if (k === 'dataset') Object.assign(node.dataset, v);
      else if (k.startsWith('on') && typeof v === 'function')
        node.addEventListener(k.slice(2).toLowerCase(), v);
      else if (k in node && k !== 'list') { try { node[k] = v; } catch { node.setAttribute(k, v); } }
      else node.setAttribute(k, v);
    }
    appendKids(node, children);
    return node;
  }
  function appendKids(node, kids) {
    (Array.isArray(kids) ? kids : [kids]).forEach(c => {
      if (c == null || c === false) return;
      node.appendChild(typeof c === 'string' || typeof c === 'number'
        ? document.createTextNode(String(c)) : c);
    });
  }
  const frag = (kids) => { const f = document.createDocumentFragment(); appendKids(f, kids); return f; };
  const clear = (node) => { while (node.firstChild) node.removeChild(node.firstChild); return node; };

  /* ---- Icons: stroke SVG paths (feather-style), inlined for offline ----- */
  const ICON_PATHS = {
    dashboard: '<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>',
    invoice: '<path d="M6 2h9l4 4v14a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1z"/><path d="M14 2v5h5"/><path d="M8 12h8M8 16h8M8 8h3"/>',
    estimate: '<path d="M9 2h9l3 3v15a1 1 0 0 1-1 1H9"/><rect x="3" y="6" width="10" height="14" rx="1.5"/><path d="M6 10h4M6 13h4M6 16h2"/>',
    customers: '<circle cx="9" cy="8" r="3.2"/><path d="M3.5 20a5.5 5.5 0 0 1 11 0"/><path d="M16 5.2a3.2 3.2 0 0 1 0 5.6"/><path d="M17.5 14.4A5.5 5.5 0 0 1 20.5 19"/>',
    calendar: '<rect x="3" y="4.5" width="18" height="16" rx="2"/><path d="M3 9h18M8 2.5v4M16 2.5v4"/><path d="M7.5 13h2M11 13h2M14.5 13h2M7.5 16.5h2M11 16.5h2"/>',
    financials: '<path d="M3 3v18h18"/><path d="M7 14l3.5-3.5 3 3L21 7"/>',
    receipt: '<path d="M5 2l1.5 1.5L8 2l1.5 1.5L11 2l1.5 1.5L14 2l1.5 1.5L17 2v18l-1.5-1.5L14 20l-1.5-1.5L11 20l-1.5-1.5L8 20l-1.5-1.5L5 20V2z"/><path d="M8 7h6M8 10.5h6M8 14h4"/>',
    pricebook: '<path d="M4 5a2 2 0 0 1 2-2h13v17H6a2 2 0 0 0-2 2z"/><path d="M4 5v14a2 2 0 0 0 2 2"/><path d="M9 7h6M9 10h6"/>',
    email: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M4 7l8 6 8-6"/>',
    reports: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M8 16v-4M12 16V8M16 16v-6"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/>',
    more: '<circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>',
    moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4 12H2M22 12h-2M5 5L4 4M20 20l-1-1M5 19l-1 1M20 4l-1 1"/>',
    bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/>',
    check: '<path d="M20 6L9 17l-5-5"/>',
    x: '<path d="M18 6L6 18M6 6l12 12"/>',
    alert: '<path d="M12 9v4M12 17h.01"/><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/>',
    wifi_off: '<path d="M1 1l22 22M16.7 11.7A6 6 0 0 1 19 13M5 13a10 10 0 0 1 4-2.6M8.5 16.5a4 4 0 0 1 5 0M2 8.8a16 16 0 0 1 5-3"/><path d="M12 20h.01"/>',
    download: '<path d="M12 3v12M7 11l5 5 5-5"/><path d="M5 21h14"/>',
    money: '<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2.6"/><path d="M6 12h.01M18 12h.01"/>',
    calendar_plus: '<rect x="3" y="4.5" width="18" height="16" rx="2"/><path d="M3 9h18M8 2.5v4M16 2.5v4"/><path d="M12 12v5M9.5 14.5h5"/>',
    user_plus: '<circle cx="9" cy="8" r="3.2"/><path d="M3.5 20a5.5 5.5 0 0 1 11 0"/><path d="M19 8v6M16 11h6"/>',
    inbox: '<path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.5 5h13l3.5 7v6a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-6z"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    route: '<circle cx="6" cy="19" r="2.5"/><circle cx="18" cy="5" r="2.5"/><path d="M8.5 19H15a3.5 3.5 0 0 0 0-7H9a3.5 3.5 0 0 1 0-7h6.5"/>',
    chevron: '<path d="M9 6l6 6-6 6"/>',
  };
  function icon(name, cls = '') {
    const p = ICON_PATHS[name] || ICON_PATHS.dashboard;
    const svg = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" class="${cls}">${p}</svg>`;
    const t = document.createElement('template'); t.innerHTML = svg.trim();
    return t.content.firstChild;
  }
  const iconHTML = (name) =>
    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">${ICON_PATHS[name] || ''}</svg>`;

  /* ---- Formatters ------------------------------------------------------- */
  const fmtMoney = (n, cents = true) =>
    (n < 0 ? '-$' : '$') + Math.abs(Number(n) || 0)
      .toLocaleString('en-US', { minimumFractionDigits: cents ? 2 : 0,
                                 maximumFractionDigits: cents ? 2 : 0 });
  const fmtMoneyShort = (n) => {
    const a = Math.abs(Number(n) || 0), s = n < 0 ? '-' : '';
    if (a >= 1000) return s + '$' + (a / 1000).toFixed(a >= 10000 ? 0 : 1) + 'k';
    return fmtMoney(n, false);
  };
  const _toDate = (d) => (typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d)) ? new Date(d + 'T00:00:00') : new Date(d);
  const fmtDate = (d, opts) => d ? _toDate(d).toLocaleDateString('en-US',
    opts || { month: 'short', day: 'numeric', year: 'numeric' }) : '';
  const fmtDateShort = (d) => fmtDate(d, { month: 'short', day: 'numeric' });
  const fmtTime = (t) => {
    if (!t) return ''; const [h, m] = String(t).split(':').map(Number);
    const ap = h >= 12 ? 'PM' : 'AM', hh = ((h + 11) % 12) + 1;
    return `${hh}:${String(m || 0).padStart(2, '0')} ${ap}`;
  };
  const initials = (name = '') => name.trim().split(/\s+/).slice(0, 2)
    .map(w => w[0] || '').join('').toUpperCase() || '?';
  const relDate = (d) => {
    if (!d) return ''; const days = Math.round((_toDate(d) - new Date().setHours(0,0,0,0)) / 864e5);
    if (days === 0) return 'Today'; if (days === 1) return 'Tomorrow'; if (days === -1) return 'Yesterday';
    if (days > 1 && days < 7) return `In ${days} days`; if (days < 0 && days > -7) return `${-days} days ago`;
    return fmtDateShort(d);
  };

  /* ---- Status maps (shared by invoices, estimates, jobs) ---------------- */
  const INVOICE_STATUS = {
    paid:    { label: 'Paid',    cls: 'green' },
    pending: { label: 'Pending', cls: 'amber' },
    unpaid:  { label: 'Unpaid',  cls: 'slate' },
    overdue: { label: 'Overdue', cls: 'red' },
    draft:   { label: 'Draft',   cls: 'slate' },
  };
  const ESTIMATE_STATUS = {
    draft:    { label: 'Draft',    cls: 'slate' },
    sent:     { label: 'Sent',     cls: 'sky' },
    accepted: { label: 'Accepted', cls: 'green' },
    declined: { label: 'Declined', cls: 'red' },
    converted:{ label: 'Converted',cls: 'violet' },
  };
  const JOB_STATUS = {
    scheduled:  { label: 'Scheduled',       cls: 'sky' },
    confirmed:  { label: 'Confirmed',       cls: 'teal' },
    inprogress: { label: 'In Progress',     cls: 'amber' },
    completed:  { label: 'Completed',       cls: 'green' },
    waiting:    { label: 'Waiting for Parts',cls: 'violet' },
    cancelled:  { label: 'Cancelled',       cls: 'slate' },
    estimate:   { label: 'Estimate',        cls: 'slate' },
  };
  function pill(map, key) {
    const s = map[key] || { label: key || '—', cls: 'slate' };
    return el('span.pill.' + s.cls, [el('span.dot'), s.label]);
  }

  /* ---- Toasts ----------------------------------------------------------- */
  function toast(msg, kind = 'ok', ms = 2600) {
    let host = document.getElementById('toasts');
    if (!host) { host = el('div#toasts'); document.body.appendChild(host); }
    const t = el('div.toast.' + (kind === 'err' ? 'err' : 'ok'),
      [icon(kind === 'err' ? 'alert' : 'check'), el('span', { text: msg })]);
    host.appendChild(t);
    setTimeout(() => { t.style.opacity = '0'; t.style.transition = 'opacity .2s';
      setTimeout(() => t.remove(), 220); }, ms);
  }

  /* ---- Modal ------------------------------------------------------------ */
  // UI.modal({ title, body:Node|string, actions:[{label,kind,onClick,close}], onClose })
  function modal({ title = '', body = '', actions = [], onClose } = {}) {
    const backdrop = el('div.modal-backdrop');
    const close = () => { backdrop.classList.remove('open');
      setTimeout(() => { backdrop.remove(); onClose && onClose(); }, 220); };
    const foot = el('div.modal-foot');
    (actions.length ? actions : [{ label: 'Close', kind: 'ghost', close: true }])
      .forEach(a => foot.appendChild(el('button.btn.btn-' + (a.kind || 'ghost'),
        { onClick: async () => { const keep = await (a.onClick && a.onClick()); if (a.close !== false && keep !== false) close(); } },
        a.label)));
    const m = el('div.modal', [
      el('div.modal-head', [ el('h3', { text: title }),
        el('button.icon-btn', { onClick: close, style: 'margin-left:auto', 'aria-label': 'Close' }, icon('x')) ]),
      el('div.modal-body', [ typeof body === 'string' ? el('div', { html: body }) : body ]),
      foot,
    ]);
    backdrop.appendChild(m);
    backdrop.addEventListener('click', e => { if (e.target === backdrop) close(); });
    document.body.appendChild(backdrop);
    requestAnimationFrame(() => backdrop.classList.add('open'));
    return { close, root: m };
  }
  function confirm({ title = 'Are you sure?', message = '', confirmLabel = 'Confirm',
                     danger = false } = {}) {
    return new Promise(resolve => {
      modal({ title, body: el('p', { class: 'muted', text: message, style: 'line-height:1.5' }),
        onClose: () => resolve(false),
        actions: [
          { label: 'Cancel', kind: 'ghost', onClick: () => resolve(false) },
          { label: confirmLabel, kind: danger ? 'danger' : 'primary', onClick: () => resolve(true) },
        ] });
    });
  }

  /* ---- Empty state ------------------------------------------------------ */
  function empty({ icon: ic = 'inbox', title = 'Nothing here yet', text = '', action } = {}) {
    const node = el('div.empty', [
      el('div.ei', [icon(ic)]),
      el('h4', { text: title }),
      text && el('p', { text }),
      action && el('button.btn.btn-primary', { onClick: action.onClick },
        [icon('plus'), action.label]),
    ]);
    return node;
  }

  const skeletonRows = (n = 3) => frag(Array.from({ length: n }, () =>
    el('div.row', [ el('div.skel', { style: 'width:38px;height:38px;border-radius:10px' }),
      el('div.grow', [ el('div.skel', { style: 'width:60%;height:13px;margin-bottom:7px' }),
        el('div.skel', { style: 'width:40%;height:11px' }) ]) ])));

  return { el, frag, clear, icon, iconHTML, ICON_PATHS,
           fmtMoney, fmtMoneyShort, fmtDate, fmtDateShort, fmtTime, relDate, initials,
           INVOICE_STATUS, ESTIMATE_STATUS, JOB_STATUS, pill,
           toast, modal, confirm, empty, skeletonRows };
})();
