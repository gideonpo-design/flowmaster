/* ==========================================================================
   shared.js — cross-module helpers (App namespace)
   Used by Invoices, Estimates, Calendar, Receipts, Reports, Emails.
   ========================================================================== */
const App = (() => {
  const { el } = UI;

  /* ---- money math ------------------------------------------------------- */
  function lineAmount(li) { return (Number(li.qty) || 0) * (Number(li.price) || 0); }
  function computeTotals(lineItems, taxRate = 0) {
    let subtotal = 0, taxable = 0;
    (lineItems || []).forEach(li => {
      const amt = lineAmount(li);
      subtotal += amt;
      if (li.taxable) taxable += amt;
    });
    const taxAmount = +(taxable * (Number(taxRate) || 0) / 100).toFixed(2);
    return { subtotal: +subtotal.toFixed(2), taxAmount, total: +(subtotal + taxAmount).toFixed(2) };
  }

  /* ---- customer cache + lookups ---------------------------------------- */
  let _customers = null;
  async function customers(force) {
    if (!_customers || force) _customers = await DB.all('customers');
    return _customers;
  }
  DB.on('change', e => { if (e.store === 'customers') _customers = null; });
  async function customerName(id) {
    if (!id) return '—';
    const c = (await customers()).find(x => x.id === id);
    return c ? c.name : 'Customer';
  }
  async function customer(id) { return (await customers()).find(x => x.id === id) || null; }

  /* ---- customer <select> with inline "add new" ------------------------- */
  // returns { node, value() } ; calls onChange(id) when selection changes
  function customerSelect(selectedId, onChange) {
    const sel = el('select.select');
    const fill = async (selId) => {
      UI.clear(sel);
      sel.appendChild(el('option', { value: '' }, 'Select customer…'));
      const list = (await customers()).sort((a, b) => a.name.localeCompare(b.name));
      list.forEach(c => sel.appendChild(el('option',
        { value: c.id, selected: c.id === selId }, c.name)));
      sel.appendChild(el('option', { value: '__new' }, '➕  New customer…'));
    };
    sel.addEventListener('change', async () => {
      if (sel.value === '__new') {
        const created = await quickAddCustomer();
        await customers(true);
        await fill(created ? created.id : selectedId);
        if (created) onChange && onChange(created.id);
        else sel.value = selectedId || '';
      } else { selectedId = sel.value; onChange && onChange(sel.value || null); }
    });
    fill(selectedId);
    return { node: sel, value: () => sel.value === '__new' ? '' : sel.value, refill: fill };
  }

  // minimal modal to create a customer on the fly; resolves with the new record
  function quickAddCustomer(prefill = {}) {
    return new Promise(resolve => {
      const f = {};
      const inp = (k, ph, type = 'text') => { const i = el('input.input', { placeholder: ph, type, value: prefill[k] || '' });
        i.addEventListener('input', () => f[k] = i.value); if (prefill[k]) f[k] = prefill[k]; return i; };
      const body = el('div', [
        el('div.field', [el('label', 'Name'), inp('name', 'Customer or company name')]),
        el('div', { style: 'display:grid;grid-template-columns:1fr 1fr;gap:12px' }, [
          el('div.field', [el('label', 'Phone'), inp('phone', '(734) 555-0100', 'tel')]),
          el('div.field', [el('label', 'Email'), inp('email', 'name@email.com', 'email')]),
        ]),
        el('div.field', [el('label', 'Service address'), inp('serviceAddress', 'Street, city')]),
      ]);
      UI.modal({ title: 'New customer', body,
        onClose: () => resolve(null),
        actions: [
          { label: 'Cancel', kind: 'ghost', onClick: () => resolve(null) },
          { label: 'Add customer', kind: 'primary', onClick: async () => {
            if (!f.name) { UI.toast('Name is required', 'err'); return false; }
            f.billingAddress = f.serviceAddress || '';
            f.tags = []; f.repeatCustomer = false;
            const id = await DB.put('customers', f);
            const rec = await DB.get('customers', id);
            UI.toast('Customer added'); resolve(rec);
          } },
        ] });
    });
  }

  /* ---- Price Book picker (modal) --------------------------------------- */
  // onPick(item) called for each chosen catalog item
  async function priceBookPicker(onPick) {
    const items = (await DB.all('priceBook')).filter(i => i.active !== false);
    const cats = [...new Set(items.map(i => i.category))];
    let q = '', activeCat = 'All';
    const listEl = el('div.list', { style: 'max-height:48vh;overflow:auto;margin:0 -18px' });
    const search = el('input.input', { placeholder: 'Search services…' });
    const chips = el('div', { style: 'display:flex;gap:6px;overflow:auto;padding:2px 0 10px' });

    function renderChips() {
      UI.clear(chips);
      ['All', ...cats].forEach(c => chips.appendChild(el('button.btn.btn-sm',
        { class: c === activeCat ? 'btn-primary' : 'btn-subtle',
          style: 'flex:none', onClick: () => { activeCat = c; render(); } }, c)));
    }
    function render() {
      renderChips();
      UI.clear(listEl);
      const filtered = items.filter(i =>
        (activeCat === 'All' || i.category === activeCat) &&
        (!q || (i.name + ' ' + i.category).toLowerCase().includes(q)));
      if (!filtered.length) { listEl.appendChild(UI.empty({ icon: 'search', title: 'No matches' })); return; }
      filtered.forEach(it => listEl.appendChild(el('div.row', { onClick: () => onPick(it) }, [
        el('div.grow', [
          el('div.t1', { text: it.name }),
          el('div.t2', { text: `${it.category} · ${UI.fmtMoney(it.defaultPrice)} / ${it.unit}` }),
        ]),
        el('button.btn.btn-sm.btn-subtle', [UI.icon('plus')]),
      ])));
    }
    search.addEventListener('input', () => { q = search.value.toLowerCase().trim(); render(); });
    render();
    UI.modal({ title: 'Add from Price Book',
      body: el('div', [el('div.field', { style: 'margin-bottom:8px' }, [search]), chips, listEl]),
      actions: [{ label: 'Done', kind: 'primary', close: true }] });
  }

  /* ---- line-item editor ------------------------------------------------ */
  // builds an editable table into `mount`; returns { items(), onChange }
  function lineItemEditor(mount, { items = [], taxRate = 0, onChange } = {}) {
    let data = items.map(x => ({ ...x }));
    const tableWrap = el('div');
    const totalsWrap = el('div', { style: 'margin-top:12px' });
    mount.appendChild(tableWrap);

    const addBar = el('div', { style: 'display:flex;gap:8px;margin-top:10px' }, [
      el('button.btn.btn-ghost.btn-sm', { onClick: () => priceBookPicker(it => {
        data.push({ id: DB.uid('li_'), name: it.name, description: it.description || '',
          qty: 1, price: it.defaultPrice, unit: it.unit, taxable: it.taxable !== false });
        rerender();
      }) }, [UI.icon('pricebook'), 'From Price Book']),
      el('button.btn.btn-subtle.btn-sm', { onClick: () => {
        data.push({ id: DB.uid('li_'), name: '', description: '', qty: 1, price: 0, taxable: true });
        rerender();
      } }, [UI.icon('plus'), 'Custom line']),
    ]);
    mount.appendChild(addBar);
    mount.appendChild(totalsWrap);

    function rerender() {
      UI.clear(tableWrap);
      if (!data.length) {
        tableWrap.appendChild(el('div.empty', { style: 'padding:24px' }, [
          el('p', { class: 'muted', text: 'No line items yet. Add from the Price Book or a custom line.' })]));
      } else {
        const list = el('div', { style: 'display:flex;flex-direction:column;gap:8px' });
        data.forEach((li, idx) => list.appendChild(itemRow(li, idx)));
        tableWrap.appendChild(list);
      }
      renderTotals();
      onChange && onChange(data, computeTotals(data, taxRate));
    }

    function itemRow(li, idx) {
      const name = el('input.input', { value: li.name, placeholder: 'Item name', style: 'font-weight:600' });
      name.addEventListener('input', () => { li.name = name.value; emit(); });
      const qty = el('input.input', { value: li.qty, type: 'number', inputmode: 'decimal',
        style: 'text-align:center', min: '0', step: 'any' });
      qty.addEventListener('input', () => { li.qty = parseFloat(qty.value) || 0; emit(); amtEl.textContent = UI.fmtMoney(lineAmount(li)); renderTotals(); });
      const price = el('input.input', { value: li.price, type: 'number', inputmode: 'decimal',
        style: 'text-align:right', min: '0', step: '0.01' });
      price.addEventListener('input', () => { li.price = parseFloat(price.value) || 0; emit(); amtEl.textContent = UI.fmtMoney(lineAmount(li)); renderTotals(); });
      const amtEl = el('div', { style: 'font-weight:700;min-width:74px;text-align:right;font-variant-numeric:tabular-nums',
        text: UI.fmtMoney(lineAmount(li)) });
      const tax = el('button.btn.btn-sm', { class: li.taxable ? 'btn-subtle' : 'btn-ghost',
        title: 'Toggle tax', style: 'min-width:40px', onClick: () => { li.taxable = !li.taxable;
          tax.className = 'btn btn-sm ' + (li.taxable ? 'btn-subtle' : 'btn-ghost');
          tax.textContent = li.taxable ? 'Tax' : 'No tax'; emit(); renderTotals(); } },
        li.taxable ? 'Tax' : 'No tax');
      const del = el('button.icon-btn', { style: 'width:36px;height:36px', 'aria-label': 'Remove',
        onClick: () => { data.splice(idx, 1); rerender(); } }, [UI.icon('x')]);

      return el('div.card', { style: 'padding:10px;background:var(--surface-2)' }, [
        el('div', { style: 'display:flex;gap:8px;align-items:center;margin-bottom:8px' }, [
          el('div', { style: 'flex:1' }, [name]), del ]),
        el('div', { style: 'display:grid;grid-template-columns:64px 1fr auto auto;gap:8px;align-items:center' }, [
          el('div', [el('label', { class: 'muted', style: 'font-size:11px;display:block;margin-bottom:2px', text: 'Qty' }), qty]),
          el('div', [el('label', { class: 'muted', style: 'font-size:11px;display:block;margin-bottom:2px', text: 'Unit price' }), price]),
          el('div', { style: 'align-self:end;padding-bottom:9px' }, [tax]),
          el('div', { style: 'align-self:end;padding-bottom:9px' }, [amtEl]),
        ]),
      ]);
    }

    function renderTotals() {
      const t = computeTotals(data, taxRate);
      UI.clear(totalsWrap);
      const line = (label, val, strong) => el('div',
        { style: `display:flex;justify-content:space-between;padding:5px 0;${strong ? 'font-weight:800;font-size:17px;border-top:1px solid var(--line);margin-top:4px;padding-top:10px' : ''}` },
        [el('span', { class: strong ? '' : 'muted', text: label }),
         el('span', { class: 'num', text: UI.fmtMoney(val) })]);
      totalsWrap.appendChild(el('div.card.card-pad', { style: 'max-width:280px;margin-left:auto' }, [
        line('Subtotal', t.subtotal),
        line(`Tax (${taxRate}%)`, t.taxAmount),
        line('Total', t.total, true),
      ]));
    }

    function emit() { onChange && onChange(data, computeTotals(data, taxRate)); }
    rerender();

    return {
      items: () => data,
      totals: () => computeTotals(data, taxRate),
      setTaxRate: (r) => { taxRate = r; rerender(); },
    };
  }

  /* ---- photo input (file -> dataURL, downscaled) ----------------------- */
  function fileToDataURL(file, maxDim = 1280, quality = 0.8) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const img = new Image();
        img.onload = () => {
          let { width: w, height: h } = img;
          if (Math.max(w, h) > maxDim) { const s = maxDim / Math.max(w, h); w *= s; h *= s; }
          const c = document.createElement('canvas'); c.width = w; c.height = h;
          c.getContext('2d').drawImage(img, 0, 0, w, h);
          resolve(c.toDataURL('image/jpeg', quality));
        };
        img.onerror = reject; img.src = reader.result;
      };
      reader.onerror = reject; reader.readAsDataURL(file);
    });
  }

  /* ---- recurrence ------------------------------------------------------- */
  function addInterval(dateStr, freq, n = 1) {
    const d = new Date(dateStr + 'T00:00:00');
    if (freq === 'weekly') d.setDate(d.getDate() + 7 * n);
    else if (freq === 'biweekly') d.setDate(d.getDate() + 14 * n);
    else if (freq === 'monthly') d.setMonth(d.getMonth() + n);
    else if (freq === 'yearly') d.setFullYear(d.getFullYear() + n);
    return d.toISOString().slice(0, 10);
  }

  /* ---- searchable list header (reused by list views) ------------------- */
  function listHeader({ title, count, searchPh = 'Search…', onSearch, primaryLabel, onPrimary }) {
    const search = el('input.input', { placeholder: searchPh, style: 'padding-left:38px' });
    search.addEventListener('input', () => onSearch(search.value.toLowerCase().trim()));
    return el('div', { style: 'margin-bottom:16px' }, [
      el('div', { style: 'display:flex;align-items:center;gap:10px;margin-bottom:12px' }, [
        el('h1', { style: 'font-size:21px;font-weight:800;letter-spacing:-.4px', text: title }),
        count != null && el('span.pill.slate', { text: String(count) }),
        el('div', { style: 'flex:1' }),
        onPrimary && el('button.btn.btn-primary', { onClick: onPrimary }, [UI.icon('plus'),
          el('span.desktop-only', { text: primaryLabel || 'New' })]),
      ]),
      el('div', { style: 'position:relative' }, [
        el('div', { style: 'position:absolute;left:12px;top:50%;transform:translateY(-50%);color:var(--muted);pointer-events:none' }, [UI.icon('search')]),
        search,
      ]),
    ]);
  }

  return { lineAmount, computeTotals, customers, customer, customerName, customerSelect,
           quickAddCustomer, priceBookPicker, lineItemEditor, fileToDataURL, addInterval, listHeader };
})();
