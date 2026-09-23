/* ==========================================================================
   views/estimates.js — Quotes / Estimates
   List · builder · detail with status (sent/accepted/declined) and one-tap
   conversion into an invoice.
   ========================================================================== */
(function () {
  const { el } = UI;
  const today = () => new Date().toISOString().slice(0, 10);
  const addDays = (d, n) => { const x = new Date(d + 'T00:00:00'); x.setDate(x.getDate() + n); return x.toISOString().slice(0, 10); };

  Router.register('estimates', {
    title: 'Estimates',
    async render(view, params) {
      if (params.new || params.newFor) return builder(view, null, { customerId: params.newFor });
      if (params.edit) return builder(view, await DB.get('estimates', params.edit));
      if (params.id) return detail(view, params.id);
      return list(view);
    },
  });

  async function list(view) {
    const [all, customers] = await Promise.all([DB.all('estimates'), App.customers()]);
    let q = '', filter = 'all';
    const body = el('div');
    view.appendChild(App.listHeader({
      title: 'Estimates', count: all.length, searchPh: 'Search number, customer…',
      primaryLabel: 'New estimate', onPrimary: () => Router.go('estimates', { new: 1 }),
      onSearch: v => { q = v; render(); },
    }));
    const chips = el('div', { style: 'display:flex;gap:6px;overflow:auto;margin-bottom:14px' });
    [['all', 'All'], ['draft', 'Drafts'], ['sent', 'Sent'], ['accepted', 'Accepted'], ['declined', 'Declined'], ['converted', 'Converted']]
      .forEach(([k, label]) => chips.appendChild(el('button.btn.btn-sm',
        { class: k === filter ? 'btn-primary' : 'btn-subtle', style: 'flex:none', onClick: () => { filter = k; render(); } }, label)));
    view.appendChild(chips); view.appendChild(body);

    function render() {
      UI.clear(body);
      let rows = all.slice();
      if (filter !== 'all') rows = rows.filter(e => e.status === filter);
      if (q) rows = rows.filter(e => { const c = customers.find(x => x.id === e.customerId);
        return ((e.number || '') + ' ' + (c ? c.name : '')).toLowerCase().includes(q); });
      rows.sort((a, b) => (b.issueDate || '').localeCompare(a.issueDate || ''));
      if (!rows.length) { body.appendChild(UI.empty({ icon: 'estimate',
        title: all.length ? 'No matching estimates' : 'No estimates yet',
        text: all.length ? 'Adjust your search or filter.' : 'Quote a job, then convert the accepted one into an invoice in one tap.',
        action: all.length ? null : { label: 'New estimate', onClick: () => Router.go('estimates', { new: 1 }) } })); return; }
      const card = el('div.card'); const listEl = el('div.list');
      rows.forEach(e => { const c = customers.find(x => x.id === e.customerId);
        listEl.appendChild(el('div.row', { onClick: () => Router.go('estimates', { id: e.id }) }, [
          el('div.avatar', { text: UI.initials(c ? c.name : '?') }),
          el('div.grow', [ el('div.t1', { text: c ? c.name : 'Customer' }),
            el('div.t2', { text: `${e.number || 'Draft'} · ${UI.fmtDateShort(e.issueDate)}` }) ]),
          el('div', { style: 'text-align:right' }, [ el('div.amt', { text: UI.fmtMoney(e.total || 0) }),
            UI.pill(UI.ESTIMATE_STATUS, e.status) ]),
        ])); });
      card.appendChild(listEl); body.appendChild(card);
    }
    render();
  }

  async function builder(view, existing, defaults = {}) {
    const settings = await DB.settings();
    const est = existing ? JSON.parse(JSON.stringify(existing)) : {
      customerId: defaults.customerId || '', status: 'draft',
      issueDate: today(), expiryDate: addDays(today(), 30),
      lineItems: [], taxRate: settings.taxRate || 0,
      technician: (settings.technicians || [])[0] || '', serviceAddress: '', notes: '',
    };
    view.appendChild(el('div', { style: 'display:flex;align-items:center;gap:8px;margin-bottom:14px' }, [
      el('button.btn.btn-subtle.btn-sm', { onClick: () => existing ? Router.go('estimates', { id: existing.id }) : Router.go('estimates') }, '← Cancel'),
      el('h1', { style: 'font-size:19px;font-weight:800;flex:1', text: existing ? `Edit ${existing.number || 'estimate'}` : 'New estimate' }),
    ]));

    const metaCard = el('div.card.card-pad', { style: 'margin-bottom:14px' });
    const cs = App.customerSelect(est.customerId, async id => { est.customerId = id;
      const c = id ? await App.customer(id) : null;
      if (c && !est.serviceAddress) { addr.value = c.serviceAddress || c.billingAddress || ''; est.serviceAddress = addr.value; } });
    const d1 = el('input.input', { type: 'date', value: est.issueDate }); d1.addEventListener('change', () => est.issueDate = d1.value);
    const d2 = el('input.input', { type: 'date', value: est.expiryDate }); d2.addEventListener('change', () => est.expiryDate = d2.value);
    const tech = el('select.select', [el('option', { value: '' }, 'Technician…')].concat((settings.technicians || []).map(t => el('option', { value: t, selected: t === est.technician }, t))));
    tech.addEventListener('change', () => est.technician = tech.value);
    const addr = el('input.input', { value: est.serviceAddress, placeholder: 'Service address' });
    addr.addEventListener('input', () => est.serviceAddress = addr.value);
    metaCard.append(
      el('div.field', [el('label', 'Customer'), cs.node]),
      el('div', { style: 'display:grid;grid-template-columns:1fr 1fr;gap:12px' }, [
        el('div.field', [el('label', 'Date'), d1]), el('div.field', [el('label', 'Valid until'), d2]) ]),
      el('div', { style: 'display:grid;grid-template-columns:1fr 1fr;gap:12px' }, [
        el('div.field', [el('label', 'Technician'), tech]), el('div.field', [el('label', 'Service address'), addr]) ]),
    );
    view.appendChild(metaCard);

    view.appendChild(el('div.section-title', ['Line items']));
    const mount = el('div'); view.appendChild(mount);
    const editor = App.lineItemEditor(mount, { items: est.lineItems, taxRate: est.taxRate,
      onChange: (items, totals) => { est.lineItems = items; Object.assign(est, totals); } });

    const notes = el('textarea.textarea', { value: est.notes, placeholder: 'Notes shown on the estimate' });
    notes.addEventListener('input', () => est.notes = notes.value);
    view.appendChild(el('div.field', { style: 'margin-top:16px' }, [el('label', 'Notes'), notes]));

    view.appendChild(el('div', { style: 'display:flex;gap:10px;margin:8px 0 24px' }, [
      el('button.btn.btn-ghost', { onClick: () => existing ? Router.go('estimates', { id: existing.id }) : Router.go('estimates') }, 'Cancel'),
      el('button.btn.btn-primary', { style: 'flex:1', onClick: save }, [UI.icon('check'), existing ? 'Save changes' : 'Create estimate']),
    ]));

    async function save() {
      if (!cs.value()) { UI.toast('Choose a customer', 'err'); return; }
      est.customerId = cs.value(); Object.assign(est, editor.totals()); est.lineItems = editor.items();
      if (!est.lineItems.length) { UI.toast('Add at least one line item', 'err'); return; }
      if (!existing && !est.number) est.number = await DB.nextNumber('estimate');
      const id = await DB.put('estimates', est);
      UI.toast(existing ? 'Estimate saved' : 'Estimate created'); Router.go('estimates', { id });
    }
  }

  async function detail(view, id) {
    const est = await DB.get('estimates', id);
    if (!est) { view.appendChild(UI.empty({ icon: 'alert', title: 'Estimate not found',
      action: { label: 'Back', onClick: () => Router.go('estimates') } })); return; }
    const c = await App.customer(est.customerId);
    const settings = await DB.settings();

    view.appendChild(el('div', { style: 'display:flex;align-items:center;gap:8px;margin-bottom:14px' }, [
      el('button.btn.btn-subtle.btn-sm', { onClick: () => Router.go('estimates') }, '← Estimates'),
      el('div', { style: 'flex:1' }),
      el('button.btn.btn-ghost.btn-sm', { onClick: () => Router.go('estimates', { edit: id }) }, [UI.icon('settings'), el('span.desktop-only', 'Edit')]),
      el('button.btn.btn-primary.btn-sm', { onClick: () => PDF.estimate(est, c, settings) }, [UI.icon('download'), el('span.desktop-only', 'PDF')]),
    ]));

    view.appendChild(el('div.card.card-pad', { style: 'margin-bottom:14px' }, [
      el('div', { style: 'display:flex;justify-content:space-between;align-items:flex-start' }, [
        el('div', [ el('div.muted', { style: 'font-size:12px;font-weight:700', text: est.number || 'Draft' }),
          el('h1', { style: 'font-size:24px;font-weight:800;letter-spacing:-.5px;margin-top:2px', text: UI.fmtMoney(est.total || 0) }),
          el('div', { style: 'margin-top:6px' }, [UI.pill(UI.ESTIMATE_STATUS, est.status)]) ]),
        el('div', { style: 'text-align:right' }, [
          c ? el('a', { href: '#', onClick: e => { e.preventDefault(); Router.go('customers', { id: c.id }); }, style: 'font-weight:700' }, c.name) : 'Customer',
          el('div.muted', { style: 'font-size:12.5px;margin-top:3px', text: 'Issued ' + UI.fmtDate(est.issueDate) }),
          est.expiryDate && el('div.muted', { style: 'font-size:12.5px', text: 'Valid until ' + UI.fmtDate(est.expiryDate) }),
        ]),
      ]),
    ]));

    const liCard = el('div.card', { style: 'margin-bottom:14px' });
    liCard.appendChild(el('div.card-head', [UI.icon('estimate'), el('h3', 'Line items')]));
    const ls = el('div.list');
    (est.lineItems || []).forEach(li => ls.appendChild(el('div.row', { style: 'cursor:default' }, [
      el('div.grow', [el('div.t1', { text: li.name }), el('div.t2', { text: `${li.qty} × ${UI.fmtMoney(li.price)}` })]),
      el('div.amt', { text: UI.fmtMoney(App.lineAmount(li)) }) ])));
    liCard.appendChild(ls);
    liCard.appendChild(el('div.card-pad', [
      tl('Subtotal', est.subtotal), tl(`Tax (${est.taxRate}%)`, est.taxAmount), tl('Total', est.total, true) ]));
    view.appendChild(liCard);

    const actions = el('div', { style: 'display:grid;gap:10px;margin-bottom:24px' });
    if (est.status !== 'converted') {
      if (est.status === 'accepted')
        actions.appendChild(el('button.btn.btn-primary', { onClick: convert }, [UI.icon('invoice'), 'Convert to invoice']));
      actions.appendChild(el('div', { style: 'display:grid;grid-template-columns:1fr 1fr;gap:10px' }, [
        el('button.btn.btn-ghost', { onClick: () => mark('accepted') }, [UI.icon('check'), 'Mark accepted']),
        el('button.btn.btn-ghost', { onClick: () => mark('declined') }, [UI.icon('x'), 'Mark declined']),
      ]));
      actions.appendChild(el('div', { style: 'display:grid;grid-template-columns:1fr 1fr;gap:10px' }, [
        el('button.btn.btn-subtle', { onClick: () => mark('sent') }, [UI.icon('email'), 'Mark sent']),
        el('button.btn.btn-subtle', { onClick: () => Router.go('emails', { compose: 'estimate', ref: id }) }, [UI.icon('email'), 'Email']),
      ]));
    } else if (est.convertedInvoiceId) {
      actions.appendChild(el('button.btn.btn-ghost', { onClick: () => Router.go('invoices', { id: est.convertedInvoiceId }) }, [UI.icon('invoice'), 'View invoice']));
    }
    actions.appendChild(el('button.btn.btn-subtle', { style: 'color:var(--red)', onClick: async () => {
      if (await UI.confirm({ title: 'Delete estimate?', danger: true, confirmLabel: 'Delete' })) {
        await DB.remove('estimates', id); UI.toast('Estimate deleted'); Router.go('estimates'); } } }, [UI.icon('x'), 'Delete estimate']));
    view.appendChild(actions);

    async function mark(status) { est.status = status; await DB.put('estimates', est); UI.toast('Marked ' + status); Router.go('estimates', { id }); }
    async function convert() {
      const inv = {
        customerId: est.customerId, status: 'unpaid', issueDate: today(),
        dueDate: addDays(today(), 15), lineItems: est.lineItems, taxRate: est.taxRate,
        subtotal: est.subtotal, taxAmount: est.taxAmount, total: est.total, amountPaid: 0, payments: [],
        technician: est.technician, serviceAddress: est.serviceAddress,
        notes: est.notes, terms: settings.invoiceTerms || '', number: await DB.nextNumber('invoice'),
        fromEstimate: est.id,
      };
      const invId = await DB.put('invoices', inv);
      est.status = 'converted'; est.convertedInvoiceId = invId; await DB.put('estimates', est);
      UI.toast('Converted to ' + inv.number); Router.go('invoices', { id: invId });
    }
  }

  function tl(label, val, strong) {
    return el('div', { style: `display:flex;justify-content:space-between;padding:5px 0;${strong ? 'font-weight:800;font-size:16px;border-top:1px solid var(--line);margin-top:4px;padding-top:9px' : ''}` },
      [el('span', { class: strong ? '' : 'muted', text: label }), el('span.num', { text: UI.fmtMoney(val) })]);
  }
})();
