/* ==========================================================================
   views/receipts.js — Expense receipts
   Capture receipts (photo + vendor + category + amount), categorize, filter,
   and see expense totals.
   ========================================================================== */
(function () {
  const { el } = UI;
  const CATEGORIES = ['Fuel', 'Materials', 'Equipment', 'Tools', 'Vehicle', 'Office', 'Insurance', 'Subcontractor', 'Permits', 'Other'];
  const today = () => new Date().toISOString().slice(0, 10);

  function editReceipt(existing, after) {
    const r = existing ? { ...existing } : { date: today(), vendor: '', category: 'Materials', amount: 0, notes: '', photo: null };
    const vendor = el('input.input', { value: r.vendor, placeholder: 'e.g. Ewing Irrigation' });
    vendor.addEventListener('input', () => r.vendor = vendor.value);
    const amount = el('input.input', { type: 'number', step: '0.01', inputmode: 'decimal', value: r.amount || '' });
    amount.addEventListener('input', () => r.amount = parseFloat(amount.value) || 0);
    const date = el('input.input', { type: 'date', value: r.date });
    date.addEventListener('change', () => r.date = date.value);
    const cat = el('select.select', CATEGORIES.map(c => el('option', { value: c, selected: c === r.category }, c)));
    cat.addEventListener('change', () => r.category = cat.value);
    const notes = el('textarea.textarea', { value: r.notes, placeholder: 'Notes (optional)' });
    notes.addEventListener('input', () => r.notes = notes.value);

    // photo
    const preview = el('div', { style: 'margin-top:8px' });
    function renderPhoto() {
      UI.clear(preview);
      if (r.photo) preview.appendChild(el('div', { style: 'position:relative;width:max-content' }, [
        el('img', { src: r.photo, style: 'max-height:160px;border-radius:12px;border:1px solid var(--line)' }),
        el('button.icon-btn', { style: 'position:absolute;top:6px;right:6px;background:var(--surface);box-shadow:var(--shadow-sm)',
          onClick: () => { r.photo = null; renderPhoto(); } }, [UI.icon('x')]),
      ]));
    }
    renderPhoto();
    const fileInput = el('input', { type: 'file', accept: 'image/*', capture: 'environment', style: 'display:none' });
    fileInput.addEventListener('change', async () => {
      if (fileInput.files[0]) { r.photo = await App.fileToDataURL(fileInput.files[0]); renderPhoto(); UI.toast('Photo attached'); }
    });

    UI.modal({ title: existing ? 'Edit receipt' : 'New receipt', body: el('div', [
      el('div', { style: 'display:grid;grid-template-columns:1fr 1fr;gap:12px' }, [
        el('div.field', [el('label', 'Amount'), amount]), el('div.field', [el('label', 'Date'), date]) ]),
      el('div', { style: 'display:grid;grid-template-columns:1fr 1fr;gap:12px' }, [
        el('div.field', [el('label', 'Vendor'), vendor]), el('div.field', [el('label', 'Category'), cat]) ]),
      el('div.field', [el('label', 'Notes'), notes]),
      el('button.btn.btn-subtle.btn-block', { onClick: () => fileInput.click() }, [UI.icon('receipt'), r.photo ? 'Replace photo' : 'Attach receipt photo']),
      fileInput, preview,
    ]), actions: [
      existing && { label: 'Delete', kind: 'danger', onClick: async () => { await DB.remove('receipts', r.id); UI.toast('Receipt deleted'); after && after(); } },
      { label: 'Cancel', kind: 'ghost' },
      { label: 'Save', kind: 'primary', onClick: async () => {
        if (!r.amount) { UI.toast('Enter an amount', 'err'); return false; }
        await DB.put('receipts', r); UI.toast('Receipt saved'); after && after();
      } },
    ].filter(Boolean) });
  }

  Router.register('receipts', {
    title: 'Receipts',
    async render(view) {
      let all = await DB.all('receipts');
      let cat = 'All', q = '';
      const body = el('div');
      async function refresh() { all = await DB.all('receipts'); render(); }

      view.appendChild(App.listHeader({
        title: 'Receipts', count: all.length, searchPh: 'Search vendor, notes…',
        primaryLabel: 'New receipt', onPrimary: () => editReceipt(null, refresh),
        onSearch: v => { q = v; render(); },
      }));

      const cats = el('div', { style: 'display:flex;gap:6px;overflow:auto;margin-bottom:14px' });
      view.appendChild(cats);
      view.appendChild(body);

      function render() {
        const usedCats = [...new Set(all.map(r => r.category))];
        UI.clear(cats);
        ['All', ...usedCats].forEach(c => cats.appendChild(el('button.btn.btn-sm',
          { class: c === cat ? 'btn-primary' : 'btn-subtle', style: 'flex:none', onClick: () => { cat = c; render(); } }, c)));

        UI.clear(body);
        let rows = all.filter(r => (cat === 'All' || r.category === cat) &&
          (!q || ((r.vendor || '') + ' ' + (r.notes || '')).toLowerCase().includes(q)));
        rows.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
        const total = rows.reduce((a, r) => a + (r.amount || 0), 0);

        body.appendChild(el('div.card.card-pad', { style: 'margin-bottom:14px;display:flex;justify-content:space-between;align-items:center' }, [
          el('div', [el('div.muted', { style: 'font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.04em', text: cat === 'All' ? 'Total expenses' : cat }),
            el('div', { style: 'font-size:24px;font-weight:800;letter-spacing:-.5px;margin-top:2px', text: UI.fmtMoney(total) })]),
          el('div.qi.tint-amber', { style: 'width:42px;height:42px' }, [UI.icon('receipt')]),
        ]));

        if (!rows.length) { body.appendChild(UI.empty({ icon: 'receipt',
          title: all.length ? 'No matching receipts' : 'No receipts yet',
          text: all.length ? 'Try another category or search.' : 'Snap a photo of a receipt to start tracking expenses.',
          action: all.length ? null : { label: 'New receipt', onClick: () => editReceipt(null, refresh) } })); return; }

        const card = el('div.card'); const list = el('div.list');
        rows.forEach(r => list.appendChild(el('div.row', { onClick: () => editReceipt(r, refresh) }, [
          r.photo ? el('img', { src: r.photo, style: 'width:40px;height:40px;border-radius:9px;object-fit:cover;flex:none' })
                  : el('div.qi.tint-amber', { style: 'width:40px;height:40px;flex:none' }, [UI.icon('receipt')]),
          el('div.grow', [ el('div.t1', { text: r.vendor || r.category }),
            el('div.t2', { text: `${r.category} · ${UI.fmtDate(r.date)}` }) ]),
          el('div.amt', { text: UI.fmtMoney(r.amount || 0) }),
        ])));
        card.appendChild(list); body.appendChild(card);
      }
      render();
    },
  });
})();
