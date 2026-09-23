/* ==========================================================================
   router.js — minimal hash router for the SPA shell
   --------------------------------------------------------------------------
   Each module registers a route:
     Router.register('invoices', {
       title: 'Invoices',
       render(outlet, params) { ... }   // build the screen into `outlet`
     });
   Navigate with Router.go('invoices') or links like href="#/invoices".
   The shell (app.js) listens to Router.onChange to sync nav highlighting.
   ========================================================================== */

const Router = (() => {
  const routes = {};
  const changeCbs = [];
  let current = null;

  function register(name, def) { routes[name] = def; }
  function has(name) { return !!routes[name]; }
  function onChange(cb) { changeCbs.push(cb); }

  function parse() {
    const raw = (location.hash || '#/dashboard').replace(/^#\/?/, '');
    const [path, query] = raw.split('?');
    const parts = path.split('/').filter(Boolean);
    const name = parts[0] || 'dashboard';
    const params = { id: parts[1] || null };
    if (query) new URLSearchParams(query).forEach((v, k) => (params[k] = v));
    return { name, params };
  }

  function go(name, params) {
    let hash = '#/' + name;
    if (params && params.id) hash += '/' + params.id;
    const q = params && Object.entries(params).filter(([k]) => k !== 'id');
    if (q && q.length) hash += '?' + new URLSearchParams(Object.fromEntries(q)).toString();
    if (location.hash === hash) render();           // force re-render same route
    else location.hash = hash;
  }

  async function render() {
    const { name, params } = parse();
    const def = routes[name] || routes['__notfound'] || routes['dashboard'];
    const outlet = document.getElementById('outlet');
    if (!outlet) return;
    current = name;

    // Update page title in the top bar
    const titleEl = document.querySelector('.topbar .page-title');
    if (titleEl) titleEl.textContent = def.title || name;
    document.title = (def.title ? def.title + ' · ' : '') + 'FlowMaster';

    UI.clear(outlet);
    const view = UI.el('div.view-enter');
    outlet.appendChild(view);
    try {
      await def.render(view, params);
    } catch (err) {
      console.error('[Router] render error in', name, err);
      view.appendChild(UI.empty({ icon: 'alert', title: 'Something went wrong',
        text: 'This screen failed to load. Check the console for details.' }));
    }
    window.scrollTo(0, 0);
    changeCbs.forEach(cb => cb(name, params));
  }

  function start() {
    window.addEventListener('hashchange', render);
    render();
  }

  return { register, has, go, onChange, start, get current() { return current; } };
})();
