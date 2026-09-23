/* ==========================================================================
   views/customers.js — Customer CRM
   List + search, full detail with service history (invoices/estimates/jobs),
   editor with contact info, tags, repeat flag, and irrigation system details.
   ========================================================================== */
(function () {
  const { el } = UI;

  /* ---- editor modal ----------------------------------------------------- */
  function editCustomer(existing, after) {
    const c = existing ? { ...existing } : { tags: [], system: {}, photos: [] };
    c.system = c.system || {};
    const f = (label, key, opts = {}) => {
      const i = opts.ta ? el('textarea.textarea', { value: c[key] || '' })
        : el('input.input', { value: c[key] ?? '', type: opts.type || 'text',
            placeholder: opts.ph || '', inputmode: opts.inputmode });
      i.addEventListener('input', () => c[key] = i.value);
      return el('div.field', [el('label', label), i]);
    };
    const sf = (label, key, opts = {}) => {
      const i = el('input.input', { value: c.system[key] ?? '', placeholder: opts.ph || '',
        inputmode: opts.inputmode });
      i.addEventListener('input', () => c.system[key] = i.value);
      return el('div.field', [el('label', label), i]);
    };
    const row2 = (a, b) => el('div', { style: 'display:grid;grid-template-columns:1fr 1fr;gap:12px' }, [a, b]);

    // tags editor
    const tagWrap = el('div', { style: 'display:flex;flex-wrap:wrap;gap:6px;margin-bottom:8px' });
    function renderTags() {
      UI.clear(tagWrap);
      (c.tags || []).forEach((t, i) => tagWrap.appendChild(el('span.pill.violet', { style: 'padding:5px 9px' }, [
        t, el('button', { style: 'background:none;border:none;cursor:pointer;color:inherit;display:flex;padding:0;margin-left:2px',
          onClick: () => { c.tags.splice(i, 1); renderTags(); } }, [UI.icon('x')]) ])));
    }
    renderTags();
    const tagInput = el('input.input', { placeholder: 'Add tag (e.g. VIP, Commercial) — Enter' });
    tagInput.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault();
      const v = tagInput.value.trim(); if (v) { c.tags = [...(c.tags || []), v]; tagInput.value = ''; renderTags(); } } });

    const repeat = el('input', { type: 'checkbox', checked: !!c.repeatCustomer, style: 'width:18px;height:18px' });
    repeat.addEventListener('change', () => c.repeatCustomer = repeat.checked);

    const body = el('div', [
      f('Name / company', 'name', { ph: 'Maple Grove HOA' }),
      row2(f('Phone', 'phone', { type: 'tel', ph: '(734) 555-0100' }), f('Email', 'email', { type: 'email' })),
      f('Billing address', 'billingAddress', { ph: 'Street, City, ST ZIP' }),
      f('Service address', 'serviceAddress', { ph: 'If different from billing' }),
      el('label', { class: 'flex center gap-8', style: 'margin:6px 0 14px;cursor:pointer;font-size:14px;font-weight:600' },
        [repeat, 'Repeat customer']),
      el('div.section-title', { style: 'margin-top:4px' }, ['Tags']),
      tagWrap, tagInput,
      el('div.section-title', ['Irrigation system']),
      row2(sf('Zones', 'zones', { inputmode: 'numeric', ph: '8' }), sf('Controller', 'controller', { ph: 'Rachio 3' })),
      row2(sf('Backflow', 'backflow', { ph: 'PVB 3/4"' }), sf('Valves', 'valves', { ph: 'Hunter PGV' })),
      sf('System notes', 'notes', { ph: 'Mainline location, quirks…' }),
      el('div.section-title', ['Customer notes']),
      f('Notes', 'notes', { ta: true }),
    ]);

    UI.modal({ title: existing ? 'Edit customer' : 'New customer', body,
      actions: [
        { label: 'Cancel', kind: 'ghost' },
        { label: existing ? 'Save' : 'Add customer', kind: 'primary', onClick: async () => {
          if (!c.name || !c.name.trim()) { UI.toast('Name is required', 'err'); return false; }
          const id = await DB.put('customers', c);
          UI.toast(existing ? 'Customer updated' : 'Customer added');
          after && after(id);
        } },
      ] });
  }

  /* ---- list view -------------------------------------------------------- */
  Router.register('customers', {
    title: 'Customers',
    async render(view, params) {
      if (params && params.id) return renderDetail(view, params);
      let all = await DB.all('customers');
      let q = '';
      const listCard = el('div.card');
      view.appendChild(App.listHeader({
        title: 'Customers', count: all.length, searchPh: 'Search name, phone, email, tag…',
        primaryLabel: 'New customer', onPrimary: () => editCustomer(null, id => Router.go('customers', { id })),
        onSearch: (v) => { q = v; render(); },
      }));
      view.appendChild(listCard);

      function match(c) {
        if (!q) return true;
        return (c.name + ' ' + (c.phone || '') + ' ' + (c.email || '') + ' ' + (c.tags || []).join(' '))
          .toLowerCase().includes(q);
      }
      function render() {
        UI.clear(listCard);
        const rows = all.filter(match).sort((a, b) => a.name.localeCompare(b.name));
        if (!rows.length) {
          listCard.appendChild(UI.empty({ icon: 'customers',
            title: all.length ? 'No matches' : 'No customers yet',
            text: all.length ? 'Try a different search.' : 'Add your first customer, or they’ll be created automatically from invoices and estimates.',
            action: all.length ? null : { label: 'New customer', onClick: () => editCustomer(null, id => Router.go('customers', { id })) } }));
          return;
        }
        const list = el('div.list');
        rows.forEach(c => list.appendChild(el('div.row', { onClick: () => Router.go('customers', { id: c.id }) }, [
          el('div.avatar', { text: UI.initials(c.name) }),
          el('div.grow', [
            el('div.t1', [c.name, c.repeatCustomer ? el('span.pill.green', { style: 'margin-left:8px;padding:1px 7px;font-size:11px' }, 'Repeat') : '']),
            el('div.t2', { text: [c.phone, c.email].filter(Boolean).join(' · ') || c.serviceAddress || 'No contact info' }),
          ]),
          (c.tags && c.tags.length) ? el('span.pill.violet', { style: 'padding:2px 8px' }, c.tags[0]) : '',
          UI.icon('chevron'),
        ])));
        listCard.appendChild(list);
      }
      render();
    },
  });

  /* ---- detail view ------------------------------------------------------ */
  async function renderDetail(view, params) {
    const c = await DB.get('customers', params.id);
    if (!c) { view.appendChild(UI.empty({ icon: 'alert', title: 'Customer not found',
      action: { label: 'Back to customers', onClick: () => Router.go('customers') } })); return; }

    const [invoices, estimates, jobs] = await Promise.all([
      DB.where('invoices', 'customerId', c.id),
      DB.where('estimates', 'customerId', c.id),
      DB.where('jobs', 'customerId', c.id),
    ]);
    const totalBilled = invoices.filter(i => i.status === 'paid').reduce((a, i) => a + (i.total || 0), 0);
    const outstanding = invoices.filter(i => ['unpaid','pending','overdue'].includes(i.status))
      .reduce((a, i) => a + ((i.total || 0) - (i.amountPaid || 0)), 0);

    // header
    view.appendChild(el('div', { style: 'display:flex;align-items:center;gap:8px;margin-bottom:14px' }, [
      el('button.btn.btn-subtle.btn-sm', { onClick: () => Router.go('customers') }, '← Customers'),
      el('div', { style: 'flex:1' }),
      el('button.btn.btn-ghost.btn-sm', { onClick: () => editCustomer(c, () => Router.go('customers', { id: c.id })) }, [UI.icon('settings'), el('span.desktop-only', 'Edit')]),
      el('button.icon-btn', { 'aria-label': 'Delete', onClick: async () => {
        if (await UI.confirm({ title: 'Delete customer?', danger: true, confirmLabel: 'Delete',
          message: 'This removes the customer record. Their invoices and jobs are kept.' })) {
          await DB.remove('customers', c.id); UI.toast('Customer deleted'); Router.go('customers');
        } } }, [UI.icon('x')]),
    ]));

    view.appendChild(el('div.card.card-pad', { style: 'margin-bottom:16px' }, [
      el('div', { style: 'display:flex;align-items:center;gap:14px' }, [
        el('div.avatar', { style: 'width:52px;height:52px;font-size:18px;border-radius:14px', text: UI.initials(c.name) }),
        el('div', { style: 'flex:1;min-width:0' }, [
          el('h1', { style: 'font-size:20px;font-weight:800;letter-spacing:-.4px', text: c.name }),
          el('div.muted', { style: 'font-size:13px;margin-top:2px',
            text: c.serviceAddress || c.billingAddress || '' }),
          el('div', { style: 'margin-top:6px;display:flex;gap:6px;flex-wrap:wrap' },
            (c.tags || []).map(t => el('span.pill.violet', { style: 'padding:2px 8px' }, t))
            .concat(c.repeatCustomer ? [el('span.pill.green', { style: 'padding:2px 8px' }, 'Repeat')] : [])),
        ]),
      ]),
      el('div', { style: 'display:flex;gap:8px;margin-top:14px;flex-wrap:wrap' }, [
        c.phone && el('a.btn.btn-ghost.btn-sm', { href: 'tel:' + c.phone }, [UI.icon('customers'), 'Call']),
        c.email && el('a.btn.btn-ghost.btn-sm', { href: 'mailto:' + c.email }, [UI.icon('email'), 'Email']),
        el('button.btn.btn-subtle.btn-sm', { onClick: () => Router.go('invoices', { newFor: c.id }) }, [UI.icon('invoice'), 'New invoice']),
        el('button.btn.btn-subtle.btn-sm', { onClick: () => Router.go('estimates', { newFor: c.id }) }, [UI.icon('estimate'), 'New estimate']),
        el('button.btn.btn-subtle.btn-sm', { onClick: () => Router.go('calendar', { newFor: c.id }) }, [UI.icon('calendar'), 'Schedule']),
      ]),
    ]));

    // money summary
    view.appendChild(el('div.stat-grid', { style: 'grid-template-columns:1fr 1fr;margin-bottom:8px' }, [
      el('div.stat', [el('div.label', 'Lifetime paid'), el('div.value', { text: UI.fmtMoney(totalBilled, false) })]),
      el('div.stat', [el('div.label', 'Outstanding'), el('div.value', { style: outstanding ? 'color:var(--red)' : '', text: UI.fmtMoney(outstanding, false) })]),
    ]));

    // system details
    const sys = c.system || {};
    if (sys.zones || sys.controller || sys.backflow || sys.valves || sys.notes) {
      const item = (l, v) => v ? el('div', [el('div.muted', { style: 'font-size:11px;text-transform:uppercase;letter-spacing:.04em', text: l }), el('div', { style: 'font-weight:600;font-size:14px', text: v })]) : null;
      view.appendChild(el('div.card', { style: 'margin-top:8px' }, [
        el('div.card-head', [UI.icon('pricebook'), el('h3', 'Irrigation system')]),
        el('div.card-pad', { style: 'display:grid;grid-template-columns:repeat(2,1fr);gap:14px' }, [
          item('Zones', sys.zones), item('Controller', sys.controller),
          item('Backflow', sys.backflow), item('Valves', sys.valves),
          sys.notes ? el('div', { style: 'grid-column:1/-1' }, [item('Notes', sys.notes)]) : null,
        ]),
      ]));
    }

    if (c.notes) view.appendChild(el('div.card.card-pad', { style: 'margin-top:8px' }, [
      el('div.muted', { style: 'font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;margin-bottom:6px', text: 'Notes' }),
      el('div', { style: 'font-size:14px;line-height:1.5;white-space:pre-wrap', text: c.notes }),
    ]));

    // service history
    const histCard = el('div.card', { style: 'margin-top:8px' });
    histCard.appendChild(el('div.card-head', [UI.icon('clock'), el('h3', 'Service history')]));
    const events = [
      ...invoices.map(i => ({ kind: 'invoice', date: i.issueDate, obj: i })),
      ...estimates.map(e => ({ kind: 'estimate', date: e.issueDate, obj: e })),
      ...jobs.map(j => ({ kind: 'job', date: j.date, obj: j })),
    ].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    if (!events.length) histCard.appendChild(UI.empty({ icon: 'clock', title: 'No history yet',
      text: 'Invoices, estimates, and jobs for this customer will appear here.' }));
    else {
      const list = el('div.list');
      events.forEach(ev => {
        const o = ev.obj;
        const cfg = ev.kind === 'invoice' ? { ic: 'invoice', route: 'invoices', map: UI.INVOICE_STATUS, amt: o.total }
          : ev.kind === 'estimate' ? { ic: 'estimate', route: 'estimates', map: UI.ESTIMATE_STATUS, amt: o.total }
          : { ic: 'calendar', route: 'calendar', map: UI.JOB_STATUS, amt: null };
        list.appendChild(el('div.row', { onClick: () => Router.go(cfg.route, { id: o.id }) }, [
          el('div.qi.tint-sky', { style: 'width:36px;height:36px;flex:none' }, [UI.icon(cfg.ic)]),
          el('div.grow', [
            el('div.t1', { text: o.number || o.title || (ev.kind[0].toUpperCase() + ev.kind.slice(1)) }),
            el('div.t2', { text: UI.fmtDate(ev.date) }),
          ]),
          el('div', { style: 'text-align:right' }, [
            cfg.amt != null ? el('div.amt', { text: UI.fmtMoney(cfg.amt) }) : '',
            UI.pill(cfg.map, o.status),
          ]),
        ]));
      });
      histCard.appendChild(list);
    }
    view.appendChild(histCard);
  }

  // expose editor for other modules (e.g. quick-add) if needed
  window.editCustomer = editCustomer;
})();
