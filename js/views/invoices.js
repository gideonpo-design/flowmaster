/* ==========================================================================
   views/invoices.js — Invoices
   List · builder (customer + line items + totals) · detail with payments,
   status management, and PDF export.
   Routes (via query params on #/invoices):
     (none)        -> list
     ?new=1        -> new invoice
     ?newFor=ID    -> new invoice for a customer
     ?edit=ID      -> edit existing
     /ID           -> detail
   ========================================================================== */
(function () {
  const { el } = UI;
  const today = () => new Date().toISOString().slice(0, 10);
  const addDays = (d, n) => { const x = new Date(d + 'T00:00:00'); x.setDate(x.getDate() + n); return x.toISOString().slice(0, 10); };

  // Overdue is derived: unpaid/pending past the due date.
  function effectiveStatus(inv) {
    if (['unpaid', 'pending'].includes(inv.status) && inv.dueDate && inv.dueDate < today()
        && (inv.amountPaid || 0) < (inv.total || 0)) return 'overdue';
    return inv.status;
  }

  Router.register('invoices', {
    title: 'Invoices',
    async render(view, params) {
      if (params.new || params.newFor) return builder(view, null, { customerId: params.newFor });
      if (params.edit) { const inv = await DB.get('invoices', params.edit); return builder(view, inv); }
      if (params.id) return detail(view, params.id);
      return list(view);
    },
  });

  /* ---- list ------------------------------------------------------------- */
  async function list(view) {
    const [all, customers, settings] = await Promise.all([DB.all('invoices'), App.customers(), DB.settings()]);
    let q = '', filter = 'all';
    const body = el('div');

    view.appendChild(App.listHeader({
      title: 'Invoices', count: all.length, searchPh: 'Search number, customer…',
      primaryLabel: 'New invoice', onPrimary: () => Router.go('invoices', { new: 1 }),
      onSearch: v => { q = v; render(); },
    }));

    // filter chips
    const chips = el('div', { style: 'display:flex;gap:6px;overflow:auto;margin-bottom:14px' });
    const counts = { all: all.length };
    ['unpaid', 'overdue', 'pending', 'paid', 'draft'].forEach(s =>
      counts[s] = all.filter(i => effectiveStatus(i) === s).length);
    [['all', 'All'], ['unpaid', 'Unpaid'], ['overdue', 'Overdue'], ['pending', 'Pending'], ['paid', 'Paid'], ['draft', 'Drafts']]
      .forEach(([k, label]) => chips.appendChild(el('button.btn.btn-sm',
        { class: k === filter ? 'btn-primary' : 'btn-subtle', style: 'flex:none',
          onClick: () => { filter = k; render(); } }, `${label}${counts[k] ? ' ' + counts[k] : ''}`)));
    view.appendChild(chips);
    view.appendChild(body);

    function render() {
      UI.clear(body);
      let rows = all.map(i => ({ ...i, _s: effectiveStatus(i) }));
      if (filter !== 'all') rows = rows.filter(i => i._s === filter);
      if (q) rows = rows.filter(i => {
        const c = customers.find(x => x.id === i.customerId);
        return ((i.number || '') + ' ' + (c ? c.name : '')).toLowerCase().includes(q);
      });
      rows.sort((a, b) => (b.issueDate || b.createdAt || '').localeCompare(a.issueDate || a.createdAt || ''));
      if (!rows.length) {
        body.appendChild(UI.empty({ icon: 'invoice', title: all.length ? 'No matching invoices' : 'No invoices yet',
          text: all.length ? 'Adjust your search or filter.' : 'Create your first invoice — line items pull straight from your Price Book.',
          action: all.length ? null : { label: 'New invoice', onClick: () => Router.go('invoices', { new: 1 }) } }));
        return;
      }
      const card = el('div.card'); const listEl = el('div.list');
      rows.forEach(inv => {
        const c = customers.find(x => x.id === inv.customerId);
        const due = (inv.total || 0) - (inv.amountPaid || 0);
        listEl.appendChild(el('div.row', { onClick: () => Router.go('invoices', { id: inv.id }) }, [
          el('div.avatar', { text: UI.initials(c ? c.name : '?') }),
          el('div.grow', [
            el('div.t1', { text: c ? c.name : 'Customer' }),
            el('div.t2', { text: `${inv.number || 'Draft'} · ${UI.fmtDateShort(inv.issueDate)}` }),
          ]),
          el('div', { style: 'text-align:right' }, [
            el('div.amt', { text: UI.fmtMoney(inv.total || 0) }),
            UI.pill(UI.INVOICE_STATUS, inv._s),
          ]),
        ]));
      });
      card.appendChild(listEl); body.appendChild(card);
    }
    render();
  }

  /* ---- builder ---------------------------------------------------------- */
  async function builder(view, existing, defaults = {}) {
    const settings = await DB.settings();
    const inv = existing ? JSON.parse(JSON.stringify(existing)) : {
      customerId: defaults.customerId || '', status: 'unpaid',
      issueDate: today(), dueDate: addDays(today(), 15),
      lineItems: [], taxRate: settings.taxRate || 0, amountPaid: 0, payments: [],
      technician: (settings.technicians || [])[0] || '', serviceAddress: '',
      notes: '', terms: settings.invoiceTerms || '',
    };

    view.appendChild(el('div', { style: 'display:flex;align-items:center;gap:8px;margin-bottom:14px' }, [
      el('button.btn.btn-subtle.btn-sm', { onClick: () => existing ? Router.go('invoices', { id: existing.id }) : Router.go('invoices') }, '← Cancel'),
      el('h1', { style: 'font-size:19px;font-weight:800;flex:1', text: existing ? `Edit ${existing.number || 'invoice'}` : 'New invoice' }),
    ]));

    // customer + meta
    const metaCard = el('div.card.card-pad', { style: 'margin-bottom:14px' });
    const cs = App.customerSelect(inv.customerId, async (id) => {
      inv.customerId = id;
      const c = id ? await App.customer(id) : null;
      if (c && !inv.serviceAddress) { addrInput.value = c.serviceAddress || c.billingAddress || ''; inv.serviceAddress = addrInput.value; }
    });
    const dateInput = el('input.input', { type: 'date', value: inv.issueDate });
    dateInput.addEventListener('change', () => inv.issueDate = dateInput.value);
    const dueInput = el('input.input', { type: 'date', value: inv.dueDate });
    dueInput.addEventListener('change', () => inv.dueDate = dueInput.value);
    const techSel = el('select.select', [el('option', { value: '' }, 'Technician…')]
      .concat((settings.technicians || []).map(t => el('option', { value: t, selected: t === inv.technician }, t))));
    techSel.addEventListener('change', () => inv.technician = techSel.value);
    const addrInput = el('input.input', { value: inv.serviceAddress, placeholder: 'Service address' });
    addrInput.addEventListener('input', () => inv.serviceAddress = addrInput.value);

    metaCard.append(
      el('div.field', [el('label', 'Customer'), cs.node]),
      el('div', { style: 'display:grid;grid-template-columns:1fr 1fr;gap:12px' }, [
        el('div.field', [el('label', 'Issue date'), dateInput]),
        el('div.field', [el('label', 'Due date'), dueInput]),
      ]),
      el('div', { style: 'display:grid;grid-template-columns:1fr 1fr;gap:12px' }, [
        el('div.field', [el('label', 'Technician'), techSel]),
        el('div.field', [el('label', 'Service address'), addrInput]),
      ]),
    );
    view.appendChild(metaCard);

    // line items
    view.appendChild(el('div.section-title', ['Line items']));
    const liMount = el('div');
    view.appendChild(liMount);
    const editor = App.lineItemEditor(liMount, { items: inv.lineItems, taxRate: inv.taxRate,
      onChange: (items, totals) => { inv.lineItems = items; Object.assign(inv, totals); } });

    // notes
    const notes = el('textarea.textarea', { value: inv.notes, placeholder: 'Notes shown on the invoice' });
    notes.addEventListener('input', () => inv.notes = notes.value);
    view.appendChild(el('div.field', { style: 'margin-top:16px' }, [el('label', 'Notes'), notes]));

    // save bar
    view.appendChild(el('div', { style: 'display:flex;gap:10px;margin:8px 0 24px' }, [
      el('button.btn.btn-ghost', { onClick: () => existing ? Router.go('invoices', { id: existing.id }) : Router.go('invoices') }, 'Cancel'),
      el('button.btn.btn-primary', { style: 'flex:1', onClick: () => save() }, [UI.icon('check'), existing ? 'Save changes' : 'Create invoice']),
    ]));

    async function save() {
      if (!cs.value()) { UI.toast('Choose a customer', 'err'); return; }
      inv.customerId = cs.value();
      const t = editor.totals(); Object.assign(inv, t); inv.lineItems = editor.items();
      if (!inv.lineItems.length) { UI.toast('Add at least one line item', 'err'); return; }
      if (!existing && !inv.number) inv.number = await DB.nextNumber('invoice');
      // keep paid status accurate
      if ((inv.amountPaid || 0) >= inv.total && inv.total > 0) inv.status = 'paid';
      else if (inv.status === 'paid') inv.status = 'unpaid';
      const id = await DB.put('invoices', inv);
      // mark customer as repeat if they now have 2+ invoices
      const cInvs = await DB.where('invoices', 'customerId', inv.customerId);
      if (cInvs.length >= 2) { const c = await DB.get('customers', inv.customerId);
        if (c && !c.repeatCustomer) { c.repeatCustomer = true; await DB.put('customers', c); } }
      UI.toast(existing ? 'Invoice saved' : 'Invoice created');
      Router.go('invoices', { id });
    }
  }

  /* ---- detail ----------------------------------------------------------- */
  async function detail(view, id) {
    const inv = await DB.get('invoices', id);
    if (!inv) { view.appendChild(UI.empty({ icon: 'alert', title: 'Invoice not found',
      action: { label: 'Back to invoices', onClick: () => Router.go('invoices') } })); return; }
    const c = await App.customer(inv.customerId);
    const settings = await DB.settings();
    const due = (inv.total || 0) - (inv.amountPaid || 0);
    const eff = effectiveStatus(inv);

    view.appendChild(el('div', { style: 'display:flex;align-items:center;gap:8px;margin-bottom:14px' }, [
      el('button.btn.btn-subtle.btn-sm', { onClick: () => Router.go('invoices') }, '← Invoices'),
      el('div', { style: 'flex:1' }),
      el('button.btn.btn-ghost.btn-sm', { onClick: () => Router.go('invoices', { edit: id }) }, [UI.icon('settings'), el('span.desktop-only', 'Edit')]),
      el('button.btn.btn-primary.btn-sm', { onClick: () => PDF.invoice(inv, c, settings) }, [UI.icon('download'), el('span.desktop-only', 'PDF')]),
    ]));

    // summary
    view.appendChild(el('div.card.card-pad', { style: 'margin-bottom:14px' }, [
      el('div', { style: 'display:flex;justify-content:space-between;align-items:flex-start' }, [
        el('div', [
          el('div.muted', { style: 'font-size:12px;font-weight:700', text: inv.number || 'Draft' }),
          el('h1', { style: 'font-size:24px;font-weight:800;letter-spacing:-.5px;margin-top:2px', text: UI.fmtMoney(inv.total || 0) }),
          el('div', { style: 'margin-top:6px' }, [UI.pill(UI.INVOICE_STATUS, eff)]),
        ]),
        el('div', { style: 'text-align:right' }, [
          c ? el('a', { href: '#/customers/' + c.id, onClick: e => { e.preventDefault(); Router.go('customers', { id: c.id }); },
            style: 'font-weight:700' }, c.name) : el('span', 'Customer'),
          el('div.muted', { style: 'font-size:12.5px;margin-top:3px', text: 'Issued ' + UI.fmtDate(inv.issueDate) }),
          inv.dueDate && el('div.muted', { style: 'font-size:12.5px', text: 'Due ' + UI.fmtDate(inv.dueDate) }),
        ]),
      ]),
      due > 0.005 ? el('div.banner.warn', { style: 'margin:14px 0 0' }, [UI.icon('money'),
        el('span', { text: `${UI.fmtMoney(due)} balance due` })]) : null,
    ]));

    // line items
    const liCard = el('div.card', { style: 'margin-bottom:14px' });
    liCard.appendChild(el('div.card-head', [UI.icon('invoice'), el('h3', 'Line items')]));
    const ls = el('div.list');
    (inv.lineItems || []).forEach(li => ls.appendChild(el('div.row', { style: 'cursor:default' }, [
      el('div.grow', [ el('div.t1', { text: li.name }),
        el('div.t2', { text: `${li.qty} × ${UI.fmtMoney(li.price)}${li.taxable === false ? ' · no tax' : ''}` }) ]),
      el('div.amt', { text: UI.fmtMoney(App.lineAmount(li)) }),
    ])));
    liCard.appendChild(ls);
    liCard.appendChild(el('div.card-pad', [
      totalLine('Subtotal', inv.subtotal), totalLine(`Tax (${inv.taxRate}%)`, inv.taxAmount),
      totalLine('Total', inv.total, true),
      (inv.amountPaid > 0) ? totalLine('Paid', -inv.amountPaid) : null,
      (inv.amountPaid > 0) ? totalLine('Balance', due, true) : null,
    ].filter(Boolean)));
    view.appendChild(liCard);

    // payments
    const payCard = el('div.card', { style: 'margin-bottom:14px' });
    payCard.appendChild(el('div.card-head', [UI.icon('money'), el('h3', 'Payments'), el('div.spacer'),
      el('button.btn.btn-subtle.btn-sm', { onClick: () => recordPayment() }, [UI.icon('plus'), 'Record'])]));
    if ((inv.payments || []).length) {
      const pl = el('div.list');
      inv.payments.forEach((p, i) => pl.appendChild(el('div.row', { style: 'cursor:default' }, [
        el('div.grow', [el('div.t1', { text: UI.fmtMoney(p.amount) }),
          el('div.t2', { text: `${UI.fmtDate(p.date)}${p.method ? ' · ' + p.method : ''}` })]),
        el('button.icon-btn', { style: 'width:34px;height:34px', onClick: async () => {
          inv.payments.splice(i, 1); recompute(); await DB.put('invoices', inv); Router.go('invoices', { id }); } }, [UI.icon('x')]),
      ])));
      payCard.appendChild(pl);
    } else payCard.appendChild(el('div.card-pad', [el('p', { class: 'muted', style: 'font-size:13.5px', text: 'No payments recorded.' })]));
    view.appendChild(payCard);

    // status + actions
    const actions = el('div', { style: 'display:grid;gap:10px;margin-bottom:24px' });
    if (eff !== 'paid' && due > 0.005)
      actions.appendChild(el('button.btn.btn-primary', { onClick: () => recordPayment(due) }, [UI.icon('check'), `Mark paid (${UI.fmtMoney(due)})`]));
    actions.appendChild(el('div', { style: 'display:grid;grid-template-columns:1fr 1fr;gap:10px' }, [
      el('button.btn.btn-ghost', { onClick: () => emailFor() }, [UI.icon('email'), 'Email invoice']),
      el('button.btn.btn-ghost', { onClick: () => setStatus() }, [UI.icon('invoice'), 'Change status']),
    ]));
    actions.appendChild(el('button.btn.btn-subtle', { style: 'color:var(--red)', onClick: async () => {
      if (await UI.confirm({ title: 'Delete invoice?', danger: true, confirmLabel: 'Delete' })) {
        await DB.remove('invoices', id); UI.toast('Invoice deleted'); Router.go('invoices'); } } }, [UI.icon('x'), 'Delete invoice']));
    view.appendChild(actions);

    function recompute() {
      inv.amountPaid = (inv.payments || []).reduce((a, p) => a + (Number(p.amount) || 0), 0);
      if (inv.amountPaid >= (inv.total || 0) && inv.total > 0) inv.status = 'paid';
      else if (inv.status === 'paid') inv.status = 'unpaid';
    }
    function recordPayment(prefill) {
      const p = { date: today(), amount: prefill || due, method: 'Card' };
      const amt = el('input.input', { type: 'number', step: '0.01', value: p.amount, inputmode: 'decimal' });
      amt.addEventListener('input', () => p.amount = parseFloat(amt.value) || 0);
      const dt = el('input.input', { type: 'date', value: p.date });
      dt.addEventListener('change', () => p.date = dt.value);
      const method = el('select.select', ['Card', 'Cash', 'Check', 'Bank transfer', 'Other'].map(m => el('option', { value: m }, m)));
      method.addEventListener('change', () => p.method = method.value);
      UI.modal({ title: 'Record payment', body: el('div', [
        el('div.field', [el('label', 'Amount'), amt]),
        el('div', { style: 'display:grid;grid-template-columns:1fr 1fr;gap:12px' }, [
          el('div.field', [el('label', 'Date'), dt]), el('div.field', [el('label', 'Method'), method]) ]),
      ]), actions: [{ label: 'Cancel', kind: 'ghost' }, { label: 'Save payment', kind: 'primary', onClick: async () => {
        if (!p.amount) { UI.toast('Enter an amount', 'err'); return false; }
        inv.payments = [...(inv.payments || []), p]; recompute();
        await DB.put('invoices', inv); UI.toast('Payment recorded'); Router.go('invoices', { id }); } }] });
    }
    function setStatus() {
      const opts = [['unpaid', 'Unpaid'], ['pending', 'Pending'], ['paid', 'Paid'], ['draft', 'Draft']];
      UI.modal({ title: 'Change status', body: el('div', { style: 'display:grid;gap:8px' },
        opts.map(([k, label]) => el('button.btn.btn-ghost.btn-block', { onClick: async () => {
          inv.status = k; if (k === 'paid') { inv.amountPaid = inv.total;
            inv.payments = [{ date: today(), amount: inv.total, method: 'Marked paid' }]; }
          await DB.put('invoices', inv); UI.toast('Status updated'); Router.go('invoices', { id }); } }, label))),
        actions: [{ label: 'Cancel', kind: 'ghost', close: true }] });
    }
    function emailFor() {
      Router.go('emails', { compose: 'invoice', ref: id });
    }
  }

  function totalLine(label, val, strong) {
    return el('div', { style: `display:flex;justify-content:space-between;padding:5px 0;${strong ? 'font-weight:800;font-size:16px;border-top:1px solid var(--line);margin-top:4px;padding-top:9px' : ''}` },
      [el('span', { class: strong ? '' : 'muted', text: label }), el('span.num', { text: UI.fmtMoney(val) })]);
  }

  window.invoiceEffectiveStatus = effectiveStatus;
})();
