/* ==========================================================================
   db.js — Offline data layer (IndexedDB)
   --------------------------------------------------------------------------
   The ENTIRE app's schema is declared here, up front, so that future modules
   (CRM, Invoices, Scheduling, Financials, etc.) plug in without needing schema
   migrations. Bump DB_VERSION and add a case in upgrade() only when you add a
   new store or index later.

   Public API (all async / Promise-based):
     DB.ready()                       -> resolves when open + seeded
     DB.add(store, obj)               -> key
     DB.put(store, obj)               -> key   (insert or update)
     DB.get(store, key)               -> obj | undefined
     DB.all(store)                    -> obj[]
     DB.where(store, index, value)    -> obj[] (exact-match query on an index)
     DB.remove(store, key)            -> void
     DB.clear(store)                  -> void
     DB.count(store)                  -> number
     DB.nextNumber(kind)              -> formatted doc number, e.g. "INV-1042"
     DB.settings()                    -> settings object (cached)
     DB.saveSettings(patch)           -> merged settings
     DB.exportAll()                   -> { meta, data:{store:[...]} }
     DB.importAll(payload, {merge})   -> void
   Stores emit change events via DB.on('change', cb) -> { store, type, key }.
   ========================================================================== */

const DB = (() => {
  const DB_NAME = 'flowmaster';
  const DB_VERSION = 1;

  // Store definitions: keyPath + indexes. Add new stores here as modules grow.
  const STORES = {
    customers: { keyPath: 'id', indexes: [
      ['name', 'name'], ['email', 'email'], ['phone', 'phone'],
      ['repeat', 'repeatCustomer'], ['updatedAt', 'updatedAt'] ] },
    invoices: { keyPath: 'id', indexes: [
      ['number', 'number'], ['customerId', 'customerId'], ['status', 'status'],
      ['issueDate', 'issueDate'], ['dueDate', 'dueDate'] ] },
    estimates: { keyPath: 'id', indexes: [
      ['number', 'number'], ['customerId', 'customerId'], ['status', 'status'],
      ['issueDate', 'issueDate'] ] },
    jobs: { keyPath: 'id', indexes: [
      ['customerId', 'customerId'], ['date', 'date'], ['status', 'status'],
      ['technician', 'technician'], ['type', 'type'] ] },
    priceBook: { keyPath: 'id', indexes: [
      ['category', 'category'], ['name', 'name'], ['active', 'active'] ] },
    receipts: { keyPath: 'id', indexes: [
      ['date', 'date'], ['vendor', 'vendor'], ['category', 'category'] ] },
    emails: { keyPath: 'id', indexes: [
      ['type', 'type'], ['relatedId', 'relatedId'], ['status', 'status'],
      ['createdAt', 'createdAt'] ] },
    // Single-record stores
    settings: { keyPath: 'id' },
    counters: { keyPath: 'id' },
  };

  let dbp = null;            // Promise<IDBDatabase>
  let settingsCache = null;
  const listeners = { change: [] };

  /* ---- open / upgrade --------------------------------------------------- */
  function open() {
    if (dbp) return dbp;
    dbp = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = (e) => upgrade(req.result, e.oldVersion);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
      req.onblocked = () => console.warn('[DB] open blocked — close other tabs');
    });
    return dbp;
  }

  function upgrade(db, oldVersion) {
    // v1: create everything. Future versions: add `if (oldVersion < N) {...}`.
    for (const [name, def] of Object.entries(STORES)) {
      if (db.objectStoreNames.contains(name)) continue;
      const store = db.createObjectStore(name, { keyPath: def.keyPath });
      (def.indexes || []).forEach(([idxName, keyPath]) =>
        store.createIndex(idxName, keyPath, { unique: false }));
    }
  }

  /* ---- low-level helpers ------------------------------------------------ */
  function tx(store, mode = 'readonly') {
    return open().then(db => db.transaction(store, mode).objectStore(store));
  }
  function done(req) {
    return new Promise((res, rej) => {
      req.onsuccess = () => res(req.result);
      req.onerror = () => rej(req.error);
    });
  }
  function emit(store, type, key) {
    listeners.change.forEach(cb => { try { cb({ store, type, key }); } catch (e) {} });
  }

  /* ---- id + timestamps -------------------------------------------------- */
  function uid(prefix = '') {
    return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }
  function stamp(obj, isNew) {
    const now = new Date().toISOString();
    if (isNew && !obj.createdAt) obj.createdAt = now;
    obj.updatedAt = now;
    return obj;
  }

  /* ---- CRUD ------------------------------------------------------------- */
  async function add(store, obj) {
    if (!obj.id) obj.id = uid(idPrefix(store));
    stamp(obj, true);
    const s = await tx(store, 'readwrite');
    const key = await done(s.add(obj));
    emit(store, 'add', key);
    return key;
  }
  async function put(store, obj) {
    if (!obj.id) obj.id = uid(idPrefix(store));
    const exists = await get(store, obj.id);
    stamp(obj, !exists);
    const s = await tx(store, 'readwrite');
    const key = await done(s.put(obj));
    emit(store, exists ? 'update' : 'add', key);
    return key;
  }
  async function get(store, key) { return done((await tx(store)).get(key)); }
  async function all(store) { return done((await tx(store)).getAll()); }
  async function where(store, index, value) {
    const s = await tx(store);
    return done(s.index(index).getAll(value));
  }
  async function remove(store, key) {
    const s = await tx(store, 'readwrite');
    await done(s.delete(key));
    emit(store, 'remove', key);
  }
  async function clear(store) {
    const s = await tx(store, 'readwrite');
    await done(s.clear());
    emit(store, 'clear');
  }
  async function count(store) { return done((await tx(store)).count()); }

  function idPrefix(store) {
    return ({ customers: 'cu_', invoices: 'in_', estimates: 'es_', jobs: 'jo_',
              priceBook: 'pb_', receipts: 're_', emails: 'em_' })[store] || '';
  }

  /* ---- document numbering ---------------------------------------------- */
  // counters store: { id:'invoice'|'estimate'|'job', next:Number }
  async function nextNumber(kind) {
    const s = await tx('counters', 'readwrite');
    let rec = await done(s.get(kind));
    const cfg = await settings();
    if (!rec) {
      const starts = { invoice: cfg.invoiceStart || 1001,
                       estimate: cfg.estimateStart || 5001, job: 1 };
      rec = { id: kind, next: starts[kind] || 1 };
    }
    const n = rec.next;
    rec.next = n + 1;
    await done(s.put(rec));
    const prefix = kind === 'invoice' ? (cfg.invoicePrefix || 'INV-')
                 : kind === 'estimate' ? (cfg.estimatePrefix || 'EST-') : '';
    return prefix + n;
  }

  /* ---- settings --------------------------------------------------------- */
  async function settings() {
    if (settingsCache) return settingsCache;
    let s = await get('settings', 'app');
    if (!s) { s = { id: 'app', ...DEFAULT_SETTINGS }; await put('settings', s); }
    settingsCache = s;
    return s;
  }
  async function saveSettings(patch) {
    const cur = await settings();
    const merged = { ...cur, ...patch, id: 'app' };
    await put('settings', merged);
    settingsCache = merged;
    emit('settings', 'update', 'app');
    return merged;
  }

  /* ---- backup / restore ------------------------------------------------- */
  async function exportAll() {
    const data = {};
    for (const name of Object.keys(STORES)) data[name] = await all(name);
    return { meta: { app: 'FlowMaster', version: DB_VERSION,
                     exportedAt: new Date().toISOString() }, data };
  }
  async function importAll(payload, { merge = false } = {}) {
    const data = payload.data || {};
    for (const [store, rows] of Object.entries(data)) {
      if (!STORES[store]) continue;
      if (!merge) await clear(store);
      for (const row of rows) await put(store, row);
    }
    settingsCache = null;
    emit('*', 'import');
  }

  /* ---- events ----------------------------------------------------------- */
  function on(evt, cb) { (listeners[evt] ||= []).push(cb);
    return () => { listeners[evt] = listeners[evt].filter(f => f !== cb); }; }

  /* ---- seed ------------------------------------------------------------- */
  async function ready() {
    await open();
    await settings();                 // ensures settings record exists
    if ((await count('priceBook')) === 0) await seedPriceBook();
    return true;
  }

  // A representative starter Price Book. The full 150+ catalog and its editor
  // arrive with the Price Book / Invoices module; these give later modules
  // real data to wire against immediately.
  async function seedPriceBook() {
    const catalog = (typeof window !== 'undefined' && window.PRICEBOOK_CATALOG) || SEED_PRICEBOOK;
    const nonTaxableCats = ['Labor', 'Emergency'];
    const items = catalog.map(([category, name, unit, defaultPrice]) => ({
      id: uid('pb_'), category, name, description: '', unit, defaultPrice,
      taxable: !nonTaxableCats.includes(category), active: true,
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    }));
    const s = await tx('priceBook', 'readwrite');
    await Promise.all(items.map(it => done(s.add(it))));
    emit('priceBook', 'seed');
  }

  return { ready, add, put, get, all, where, remove, clear, count,
           nextNumber, settings, saveSettings, exportAll, importAll, on, uid,
           _stores: Object.keys(STORES) };
})();

/* ---- default settings (editable in Settings module) --------------------- */
const DEFAULT_SETTINGS = {
  // Seeded from the brief. All editable in Settings — change the business name
  // here or in-app (e.g. to "SprinklerMaster") and every screen + PDF follows.
  businessName: 'FlowMaster Irrigation Services',
  slogan: 'Sprinkling Life into your Landscape.',
  address: '1210 Prospect Street',
  city: 'Ann Arbor', state: 'MI', zip: '48104',
  phone: '(269) 370-2347',
  email: '',
  website: '',
  taxRate: 6,                 // Michigan default; editable
  invoicePrefix: 'INV-', invoiceStart: 1001,
  estimatePrefix: 'EST-', estimateStart: 5001,
  invoiceTerms: 'Payment due within 15 days of invoice date.',
  thankYou: 'Thank you for your business!',
  theme: 'system',           // 'light' | 'dark' | 'system'
  technicians: ['Gideon'],
};

/* ---- starter price book (category, name, unit, price) ------------------- */
const SEED_PRICEBOOK = [
  ['Startups', 'Spring System Startup (up to 6 zones)', 'flat', 95],
  ['Startups', 'Spring System Startup (7–12 zones)', 'flat', 135],
  ['Startups', 'Additional Zone Activation', 'zone', 8],
  ['Winterizations', 'Winterization / Blowout (up to 6 zones)', 'flat', 85],
  ['Winterizations', 'Winterization / Blowout (7–12 zones)', 'flat', 120],
  ['Repairs', 'Diagnostic / Service Call', 'flat', 75],
  ['Repairs', 'Mainline Leak Repair', 'flat', 145],
  ['Repairs', 'Lateral Line Repair', 'flat', 95],
  ['Controllers', 'Smart WiFi Controller (WaterSense) — supply & install', 'flat', 285],
  ['Controllers', 'Standard Controller Replacement', 'flat', 175],
  ['Valves', 'Zone Valve Replacement', 'each', 110],
  ['Valves', 'Backflow Preventer Test', 'flat', 65],
  ['Heads', 'Rotor Head Replacement', 'each', 22],
  ['Heads', 'Spray Head Replacement', 'each', 14],
  ['Heads', 'Head Adjustment / Alignment', 'each', 6],
  ['Drip Irrigation', 'Drip Zone Conversion', 'zone', 165],
  ['Commercial', 'Commercial System Inspection', 'flat', 195],
  ['Emergency', 'Emergency Service Call (after hours)', 'flat', 150],
  ['Labor', 'Standard Labor', 'hour', 85],
  ['Labor', 'Helper Labor', 'hour', 55],
  ['Materials', 'Misc. Materials', 'flat', 0],
];
