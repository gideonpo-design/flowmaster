/* ==========================================================================
   views/pricebook.js — master service catalog
   Browse 150+ items by category, search, edit prices, add custom services.
   ========================================================================== */
(function () {
  const { el } = UI;
  const UNITS = ['flat', 'hour', 'each', 'zone', 'ft', 'service'];

  function editItem(existing, after) {
    const it = existing ? { ...existing } : { category: '', name: '', unit: 'flat', defaultPrice: 0, taxable: true, active: true };
    const cats = (after.cats || []);
    const f = (label, node) => el('div.field', [el('label', label), node]);
    const name = el('input.input', { value: it.name, placeholder: 'Service name' });
    name.addEventListener('input', () => it.name = name.value);
    const cat = el('input.input', { value: it.category, placeholder: 'Category', list: 'pb-cats' });
    cat.addEventListener('input', () => it.category = cat.value);
    const datalist = el('datalist', { id: 'pb-cats' }, cats.map(c => el('option', { value: c })));
    const price = el('input.input', { value: it.defaultPrice, type: 'number', inputmode: 'decimal', step: '0.01' });
    price.addEventListener('input', () => it.defaultPrice = parseFloat(price.value) || 0);
    const unit = el('select.select', UNITS.map(u => el('option', { value: u, selected: u === it.unit }, u)));
    unit.addEventListener('change', () => it.unit = unit.value);
    const taxable = el('input', { type: 'checkbox', checked: it.taxable !== false, style: 'width:18px;height:18px' });
    taxable.addEventListener('change', () => it.taxable = taxable.checked);

    UI.modal({ title: existing ? 'Edit service' : 'New service',
      body: el('div', [
        f('Name', name), f('Category', cat), datalist,
        el('div', { style: 'display:grid;grid-template-columns:1fr 1fr;gap:12px' }, [
          f('Default price', price), f('Unit', unit) ]),
        el('label', { class: 'flex center gap-8', style: 'cursor:pointer;font-size:14px;font-weight:600;margin-top:4px' },
          [taxable, 'Taxable']),
      ]),
      actions: [
        existing && { label: 'Delete', kind: 'danger', onClick: async () => {
          await DB.remove('priceBook', it.id); UI.toast('Service deleted'); after.refresh && after.refresh(); } },
        { label: 'Cancel', kind: 'ghost' },
        { label: 'Save', kind: 'primary', onClick: async () => {
          if (!it.name.trim()) { UI.toast('Name required', 'err'); return false; }
          if (!it.category.trim()) it.category = 'Miscellaneous';
          await DB.put('priceBook', it); UI.toast('Saved'); after.refresh && after.refresh();
        } },
      ].filter(Boolean) });
  }

  Router.register('pricebook', {
    title: 'Price Book',
    async render(view) {
      let all = await DB.all('priceBook');
      let q = '', openCats = new Set();
      const body = el('div');
      const cats = () => [...new Set(all.map(i => i.category))].sort();

      view.appendChild(App.listHeader({
        title: 'Price Book', count: all.length, searchPh: 'Search services…',
        primaryLabel: 'New service',
        onPrimary: () => editItem(null, { cats: cats(), refresh }),
        onSearch: v => { q = v; render(); },
      }));
      view.appendChild(body);

      async function refresh() { all = await DB.all('priceBook'); render(); }
      function render() {
        UI.clear(body);
        const filtered = all.filter(i => !q || (i.name + ' ' + i.category).toLowerCase().includes(q));
        const grouped = {};
        filtered.forEach(i => (grouped[i.category] ||= []).push(i));
        const catNames = Object.keys(grouped).sort();
        if (!catNames.length) { body.appendChild(UI.empty({ icon: 'search', title: 'No services found' })); return; }
        if (q) catNames.forEach(c => openCats.add(c));

        catNames.forEach(catName => {
          const items = grouped[catName].sort((a, b) => a.name.localeCompare(b.name));
          const isOpen = openCats.has(catName) || !!q;
          const card = el('div.card', { style: 'margin-bottom:10px' });
          const head = el('div.card-head', { style: 'cursor:pointer', onClick: () => {
            if (openCats.has(catName)) openCats.delete(catName); else openCats.add(catName); render(); } }, [
            UI.icon('pricebook'),
            el('h3', { text: catName }),
            el('span.pill.slate', { style: 'margin-left:6px;padding:1px 8px', text: String(items.length) }),
            el('div.spacer'),
            el('span', { style: `transition:transform .2s;transform:rotate(${isOpen ? 90 : 0}deg);color:var(--muted);display:flex` }, [UI.icon('chevron')]),
          ]);
          card.appendChild(head);
          if (isOpen) {
            const list = el('div.list');
            items.forEach(it => list.appendChild(el('div.row', { onClick: () => editItem(it, { cats: cats(), refresh }) }, [
              el('div.grow', [
                el('div.t1', { text: it.name }),
                el('div.t2', { text: `${UI.fmtMoney(it.defaultPrice)} / ${it.unit}${it.taxable === false ? ' · no tax' : ''}` }),
              ]),
              UI.icon('chevron'),
            ])));
            card.appendChild(list);
          }
          body.appendChild(card);
        });
      }
      render();
    },
  });
})();
