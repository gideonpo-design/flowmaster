/* ==========================================================================
   views/dashboard.js — the home screen
   Computes live metrics from IndexedDB. With an empty database it shows zeros
   and an onboarding card; as later modules add data, the numbers fill in
   automatically (no wiring changes needed).
   ========================================================================== */

Router.register('dashboard', {
  title: 'Dashboard',
  async render(view) {
    const { el } = UI;

    // --- pull data ------------------------------------------------------
    const [invoices, jobs, receipts, customers, settings] = await Promise.all([
      DB.all('invoices'), DB.all('jobs'), DB.all('receipts'),
      DB.all('customers'), DB.settings(),
    ]);

    const now = new Date();
    const ym = (d) => { const x = new Date(d); return x.getFullYear() * 12 + x.getMonth(); };
    const thisMonth = ym(now);
    const todayStr = now.toISOString().slice(0, 10);

    const sum = (arr, f) => arr.reduce((a, x) => a + (Number(f(x)) || 0), 0);

    const paidThisMonth = invoices.filter(i => i.status === 'paid' && i.issueDate && ym(i.issueDate) === thisMonth);
    const revenueMonth = sum(paidThisMonth, i => i.total ?? i.amountPaid ?? 0);
    const expensesMonth = sum(receipts.filter(r => r.date && ym(r.date) === thisMonth), r => r.amount);
    const profitMonth = revenueMonth - expensesMonth;

    const unpaid = invoices.filter(i => ['unpaid', 'pending', 'overdue'].includes(i.status));
    const unpaidTotal = sum(unpaid, i => (i.total || 0) - (i.amountPaid || 0));
    const overdueCount = invoices.filter(i => i.status === 'overdue').length;

    const todaysJobs = jobs.filter(j => j.date === todayStr && j.status !== 'cancelled')
      .sort((a, b) => (a.startTime || '').localeCompare(b.startTime || ''));
    const completedJobs = jobs.filter(j => j.status === 'completed').length;

    const recentInvoices = [...invoices]
      .sort((a, b) => (b.issueDate || b.createdAt || '').localeCompare(a.issueDate || a.createdAt || ''))
      .slice(0, 5);

    const isEmpty = !invoices.length && !jobs.length && !customers.length && !receipts.length;

    // --- greeting -------------------------------------------------------
    const hr = now.getHours();
    const greet = hr < 12 ? 'Good morning' : hr < 18 ? 'Good afternoon' : 'Good evening';
    const techName = (settings.technicians && settings.technicians[0]) || '';
    view.appendChild(el('div', { style: 'margin-bottom:18px' }, [
      el('h1', { style: 'font-size:22px;font-weight:800;letter-spacing:-.5px',
        text: `${greet}${techName ? ', ' + techName : ''}` }),
      el('p', { class: 'muted', style: 'font-size:13.5px;margin-top:3px',
        text: now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }) }),
    ]));

    // --- onboarding (only when empty) -----------------------------------
    if (isEmpty) {
      view.appendChild(el('div.card.card-pad', {
        style: 'margin-bottom:20px;border-color:var(--brand-200);background:var(--brand-50)' }, [
        el('div.flex.center.gap-12', [
          el('div.qi.tint-sky', { style: 'flex:none' }, [UI.icon('dashboard')]),
          el('div', [
            el('h3', { style: 'font-size:15px;font-weight:700', text: 'Welcome to FlowMaster' }),
            el('p', { class: 'muted', style: 'font-size:13px;margin-top:3px;line-height:1.5',
              text: 'Your business runs entirely on this device and works offline. Add your business details in Settings, then start adding customers and invoices as the modules come online.' }),
          ]),
        ]),
      ]));
    }

    // --- stat tiles -----------------------------------------------------
    const stat = (tint, ic, label, value, trend) => el('div.stat', [
      el('div.ico.' + tint, [UI.icon(ic)]),
      el('div.label', { text: label }),
      el('div.value', { text: value }),
      trend && el('div.trend', { text: trend }),
    ]);

    view.appendChild(el('div.stat-grid', [
      stat('tint-green', 'money', 'Revenue (month)', UI.fmtMoney(revenueMonth, false)),
      stat('tint-sky', 'invoice', 'Unpaid', UI.fmtMoney(unpaidTotal, false),
        unpaid.length ? `${unpaid.length} invoice${unpaid.length > 1 ? 's' : ''}` +
          (overdueCount ? ` · ${overdueCount} overdue` : '') : 'All settled'),
      stat('tint-amber', 'calendar', "Jobs today", String(todaysJobs.length),
        completedJobs ? `${completedJobs} completed all-time` : null),
      stat(profitMonth >= 0 ? 'tint-violet' : 'tint-red', 'financials', 'Profit (month)',
        UI.fmtMoney(profitMonth, false)),
    ]));

    // --- quick actions --------------------------------------------------
    view.appendChild(el('div.section-title', ['Quick actions']));
    const quick = (tint, ic, label, route) => el('button.quick', {
      onClick: () => Router.go(route),
    }, [ el('div.qi.' + tint, [UI.icon(ic)]), label ]);

    view.appendChild(el('div.quick-grid', [
      quick('tint-sky', 'invoice', 'New Invoice', 'invoices'),
      quick('tint-teal', 'estimate', 'New Estimate', 'estimates'),
      quick('tint-violet', 'user_plus', 'New Customer', 'customers'),
      quick('tint-amber', 'calendar_plus', 'Schedule Job', 'calendar'),
      quick('tint-green', 'receipt', 'Add Receipt', 'receipts'),
    ]));

    // --- two-column lists ----------------------------------------------
    const grid = el('div', { style: 'display:grid;gap:16px;margin-top:22px' });
    if (window.matchMedia('(min-width: 860px)').matches)
      grid.style.gridTemplateColumns = '1fr 1fr';
    view.appendChild(grid);

    // Today's route / jobs
    const jobsCard = el('div.card');
    jobsCard.appendChild(el('div.card-head', [
      UI.icon('route'), el('h3', { text: "Today's jobs" }), el('div.spacer'),
      el('button.btn.btn-subtle.btn-sm', { onClick: () => Router.go('calendar') }, 'View calendar'),
    ]));
    if (todaysJobs.length) {
      const list = el('div.list');
      todaysJobs.forEach(j => list.appendChild(el('div.row', {
        onClick: () => Router.go('calendar', { id: j.id }) }, [
        el('div.avatar', { text: UI.fmtTime(j.startTime).replace(/\s?[AP]M/, '') || '—',
          style: 'font-size:11px' }),
        el('div.grow', [
          el('div.t1', { text: j.title || j.type || 'Job' }),
          el('div.t2', { text: j.serviceAddress || '' }),
        ]),
        UI.pill(UI.JOB_STATUS, j.status),
      ])));
      jobsCard.appendChild(list);
    } else {
      jobsCard.appendChild(UI.empty({ icon: 'calendar', title: 'No jobs scheduled today',
        text: 'Your day is clear. Schedule a job to see it here.' }));
    }
    grid.appendChild(jobsCard);

    // Recent invoices
    const invCard = el('div.card');
    invCard.appendChild(el('div.card-head', [
      UI.icon('invoice'), el('h3', { text: 'Recent invoices' }), el('div.spacer'),
      el('button.btn.btn-subtle.btn-sm', { onClick: () => Router.go('invoices') }, 'View all'),
    ]));
    if (recentInvoices.length) {
      const list = el('div.list');
      for (const inv of recentInvoices) {
        const cust = customers.find(c => c.id === inv.customerId);
        list.appendChild(el('div.row', { onClick: () => Router.go('invoices', { id: inv.id }) }, [
          el('div.avatar', { text: UI.initials(cust ? cust.name : '?') }),
          el('div.grow', [
            el('div.t1', { text: (cust ? cust.name : 'Customer') }),
            el('div.t2', { text: `${inv.number || ''} · ${UI.fmtDateShort(inv.issueDate)}` }),
          ]),
          el('div', { style: 'text-align:right' }, [
            el('div.amt', { text: UI.fmtMoney(inv.total || 0) }),
            UI.pill(UI.INVOICE_STATUS, inv.status),
          ]),
        ]));
      }
      invCard.appendChild(list);
    } else {
      invCard.appendChild(UI.empty({ icon: 'invoice', title: 'No invoices yet',
        text: 'Invoices you create will appear here with their payment status.' }));
    }
    grid.appendChild(invCard);
  },
});
