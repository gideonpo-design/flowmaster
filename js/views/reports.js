/* ==========================================================================
   views/reports.js — Business reports
   Top customers, revenue by service category, estimate win rate, repeat-customer
   rate, and a monthly revenue breakdown.
   ========================================================================== */
(function () {
  const { el } = UI;

  Router.register('reports', {
    title: 'Reports',
    async render(view) {
      const [invoices, estimates, customers, jobs] = await Promise.all([
        DB.all('invoices'), DB.all('estimates'), App.customers(), DB.all('jobs')]);

      view.appendChild(el('h1', { style: 'font-size:21px;font-weight:800;letter-spacing:-.4px;margin-bottom:16px', text: 'Reports' }));

      const paid = invoices.filter(i => (i.amountPaid || 0) > 0);
      const totalRev = paid.reduce((a, i) => a + (i.amountPaid || 0), 0);

      // ---- headline metrics ----
      const repeatCount = customers.filter(c => c.repeatCustomer).length;
      const repeatRate = customers.length ? Math.round(repeatCount / customers.length * 100) : 0;
      const decided = estimates.filter(e => ['accepted', 'declined', 'converted'].includes(e.status));
      const won = estimates.filter(e => ['accepted', 'converted'].includes(e.status));
      const winRate = decided.length ? Math.round(won.length / decided.length * 100) : 0;
      const completedJobs = jobs.filter(j => j.status === 'completed').length;

      view.appendChild(el('div.stat-grid', { style: 'grid-template-columns:repeat(2,1fr);margin-bottom:8px' }, [
        metric('Total revenue', UI.fmtMoney(totalRev, false)),
        metric('Customers', String(customers.length)),
        metric('Repeat rate', repeatRate + '%'),
        metric('Estimate win rate', winRate + '%'),
      ]));

      // ---- top customers ----
      const byCust = {};
      paid.forEach(i => byCust[i.customerId] = (byCust[i.customerId] || 0) + (i.amountPaid || 0));
      const topCust = Object.entries(byCust).map(([id, v]) => ({ c: customers.find(x => x.id === id), v }))
        .filter(x => x.c).sort((a, b) => b.v - a.v).slice(0, 6);
      view.appendChild(rankCard('Top customers', 'customers', topCust.map(x => ({ label: x.c.name, value: x.v, fmt: UI.fmtMoney(x.v) })), totalRev,
        x => Router.go('customers', { id: topCust.find(t => t.c.name === x.label).c.id })));

      // ---- revenue by service category ----
      const byCat = {};
      paid.forEach(inv => (inv.lineItems || []).forEach(li => {
        // distribute by line share of invoice, scaled to amountPaid
        const share = inv.total ? (App.lineAmount(li) / inv.total) * (inv.amountPaid || 0) : 0;
        const key = li.category || categoryOf(li.name) || 'Other';
        byCat[key] = (byCat[key] || 0) + share;
      }));
      const cats = Object.entries(byCat).map(([label, value]) => ({ label, value, fmt: UI.fmtMoney(value) }))
        .sort((a, b) => b.value - a.value).slice(0, 8);
      view.appendChild(rankCard('Revenue by service', 'pricebook', cats, totalRev));

      // ---- estimate funnel ----
      const funnel = [
        ['Drafts', estimates.filter(e => e.status === 'draft').length, 'slate'],
        ['Sent', estimates.filter(e => e.status === 'sent').length, 'sky'],
        ['Accepted', won.length, 'green'],
        ['Declined', estimates.filter(e => e.status === 'declined').length, 'red'],
      ];
      const fCard = el('div.card', { style: 'margin-bottom:14px' });
      fCard.appendChild(el('div.card-head', [UI.icon('estimate'), el('h3', 'Estimate pipeline')]));
      const fBody = el('div.card-pad', { style: 'display:flex;flex-direction:column;gap:10px' });
      const fMax = Math.max(1, ...funnel.map(f => f[1]));
      funnel.forEach(([label, n, color]) => fBody.appendChild(el('div', [
        el('div', { style: 'display:flex;justify-content:space-between;font-size:13px;margin-bottom:4px' }, [
          el('span', { class: 'muted', text: label }), el('span', { style: 'font-weight:700', text: String(n) })]),
        el('div', { style: 'height:8px;background:var(--surface-2);border-radius:5px;overflow:hidden' }, [
          el('div', { style: `height:100%;width:${(n / fMax * 100).toFixed(0)}%;background:var(--${color});border-radius:5px` })]),
      ])));
      fCard.appendChild(fBody);
      view.appendChild(fCard);

      // ---- monthly revenue ----
      const byMonth = {};
      paid.forEach(i => { const k = (i.issueDate || '').slice(0, 7); if (k) byMonth[k] = (byMonth[k] || 0) + (i.amountPaid || 0); });
      const monthRows = Object.entries(byMonth).sort((a, b) => b[0].localeCompare(a[0])).slice(0, 6)
        .map(([k, v]) => ({ label: new Date(k + '-01T00:00:00').toLocaleDateString('en-US', { month: 'long', year: 'numeric' }), value: v, fmt: UI.fmtMoney(v) }));
      if (monthRows.length) view.appendChild(rankCard('Monthly revenue', 'financials', monthRows, Math.max(...monthRows.map(r => r.value))));

      if (!paid.length && !estimates.length)
        view.appendChild(UI.empty({ icon: 'reports', title: 'No data yet',
          text: 'Reports populate automatically as you create invoices, estimates, and jobs.' }));

      function metric(label, value) {
        return el('div.stat', [el('div.label', { text: label }), el('div.value', { text: value })]);
      }
      function rankCard(title, icon, rows, max, onClick) {
        const card = el('div.card', { style: 'margin-bottom:14px' });
        card.appendChild(el('div.card-head', [UI.icon(icon), el('h3', title)]));
        if (!rows.length) { card.appendChild(el('div.card-pad', [el('p', { class: 'muted', style: 'font-size:13px', text: 'No data yet.' })])); return card; }
        const b = el('div.card-pad', { style: 'display:flex;flex-direction:column;gap:12px' });
        rows.forEach(r => b.appendChild(el('div', { style: onClick ? 'cursor:pointer' : '', onClick: onClick ? () => onClick(r) : null }, [
          el('div', { style: 'display:flex;justify-content:space-between;font-size:13.5px;margin-bottom:5px' }, [
            el('span', { style: 'font-weight:600', text: r.label }), el('span.num', { style: 'font-weight:700', text: r.fmt })]),
          el('div', { style: 'height:7px;background:var(--surface-2);border-radius:5px;overflow:hidden' }, [
            el('div', { style: `height:100%;width:${(r.value / (max || 1) * 100).toFixed(0)}%;background:var(--brand-500);border-radius:5px` })]),
        ])));
        card.appendChild(b);
        return card;
      }
    },
  });

  // rough fallback categorizer from item name keywords
  function categoryOf(name) {
    const n = (name || '').toLowerCase();
    if (n.includes('startup')) return 'Startups';
    if (n.includes('winter') || n.includes('blowout')) return 'Winterizations';
    if (n.includes('controller') || n.includes('wifi')) return 'Controllers';
    if (n.includes('valve')) return 'Valves';
    if (n.includes('backflow')) return 'Backflow';
    if (n.includes('head') || n.includes('nozzle') || n.includes('rotor') || n.includes('spray')) return 'Heads';
    if (n.includes('drip')) return 'Drip Irrigation';
    if (n.includes('repair') || n.includes('leak')) return 'Repairs';
    if (n.includes('labor')) return 'Labor';
    return null;
  }
})();
