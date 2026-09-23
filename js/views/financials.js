/* ==========================================================================
   views/financials.js — Financial overview
   Revenue (paid), outstanding, expenses (receipts), net profit, avg job value,
   monthly revenue chart, and a period selector.
   ========================================================================== */
(function () {
  const { el } = UI;
  const monthKey = (d) => (d || '').slice(0, 7);
  const monthLabel = (k) => { const [y, m] = k.split('-'); return new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'short' }); };

  Router.register('financials', {
    title: 'Financials',
    async render(view) {
      const [invoices, receipts] = await Promise.all([DB.all('invoices'), DB.all('receipts')]);
      let range = '12m';
      const body = el('div');

      view.appendChild(el('div', { style: 'display:flex;align-items:center;gap:8px;margin-bottom:14px' }, [
        el('h1', { style: 'font-size:21px;font-weight:800;letter-spacing:-.4px;flex:1', text: 'Financials' }),
      ]));
      const seg = el('div', { style: 'display:flex;gap:4px;background:var(--surface-2);padding:4px;border-radius:12px;margin-bottom:16px;width:max-content' },
        [['ytd', 'This year'], ['12m', 'Last 12 mo'], ['all', 'All time']].map(([k, label]) =>
          el('button.btn.btn-sm', { class: k === range ? 'btn-primary' : 'btn-subtle',
            style: 'box-shadow:none;border:none;' + (k === range ? '' : 'background:transparent'),
            onClick: () => { range = k; render(); } }, label)));
      view.appendChild(seg);
      view.appendChild(body);

      function inRange(dateStr) {
        if (!dateStr) return false;
        if (range === 'all') return true;
        const d = new Date(dateStr + 'T00:00:00'), now = new Date();
        if (range === 'ytd') return d.getFullYear() === now.getFullYear();
        const cutoff = new Date(); cutoff.setMonth(cutoff.getMonth() - 11); cutoff.setDate(1);
        return d >= cutoff;
      }

      function render() {
        seg.querySelectorAll('button').forEach((b, i) => {
          const k = ['ytd', '12m', 'all'][i];
          b.className = 'btn btn-sm ' + (k === range ? 'btn-primary' : 'btn-subtle');
          b.style.background = k === range ? '' : 'transparent';
        });
        UI.clear(body);

        const paidInv = invoices.filter(i => (i.amountPaid || 0) > 0);
        const revenue = paidInv.filter(i => inRange(i.issueDate)).reduce((a, i) => a + (i.amountPaid || 0), 0);
        const expenses = receipts.filter(r => inRange(r.date)).reduce((a, r) => a + (r.amount || 0), 0);
        const outstanding = invoices.filter(i => ['unpaid', 'pending'].includes(i.status))
          .reduce((a, i) => a + ((i.total || 0) - (i.amountPaid || 0)), 0);
        const completedInv = invoices.filter(i => inRange(i.issueDate) && i.total > 0);
        const avgJob = completedInv.length ? completedInv.reduce((a, i) => a + i.total, 0) / completedInv.length : 0;
        const profit = revenue - expenses;

        // KPI grid
        body.appendChild(el('div.stat-grid', { style: 'grid-template-columns:repeat(2,1fr);margin-bottom:8px' }, [
          kpi('Revenue', UI.fmtMoney(revenue, false), 'green', 'money'),
          kpi('Expenses', UI.fmtMoney(expenses, false), 'red', 'receipt'),
          kpi('Net profit', UI.fmtMoney(profit, false), profit >= 0 ? 'sky' : 'red', 'financials'),
          kpi('Outstanding', UI.fmtMoney(outstanding, false), 'amber', 'invoice'),
        ]));
        body.appendChild(el('div.stat-grid', { style: 'grid-template-columns:repeat(2,1fr);margin-bottom:16px' }, [
          kpi('Avg invoice', UI.fmtMoney(avgJob, false), 'violet', 'estimate'),
          kpi('Paid invoices', String(paidInv.filter(i => inRange(i.issueDate)).length), 'teal', 'check'),
        ]));

        // monthly revenue chart (last 12 months)
        const months = [];
        const base = new Date(); base.setDate(1);
        for (let i = 11; i >= 0; i--) { const d = new Date(base.getFullYear(), base.getMonth() - i, 1); months.push(monthKey(d.toISOString())); }
        const revByMonth = {}, expByMonth = {};
        paidInv.forEach(i => { const k = monthKey(i.issueDate); revByMonth[k] = (revByMonth[k] || 0) + (i.amountPaid || 0); });
        receipts.forEach(r => { const k = monthKey(r.date); expByMonth[k] = (expByMonth[k] || 0) + (r.amount || 0); });
        const maxVal = Math.max(1, ...months.map(k => Math.max(revByMonth[k] || 0, expByMonth[k] || 0)));

        const chartCard = el('div.card', { style: 'margin-bottom:16px' });
        chartCard.appendChild(el('div.card-head', [UI.icon('financials'), el('h3', 'Revenue vs expenses'),
          el('div.spacer'),
          el('span', { style: 'display:flex;align-items:center;gap:4px;font-size:11px;color:var(--muted)' }, [el('span', { style: 'width:9px;height:9px;border-radius:2px;background:var(--green)' }), 'Rev']),
          el('span', { style: 'display:flex;align-items:center;gap:4px;font-size:11px;color:var(--muted);margin-left:8px' }, [el('span', { style: 'width:9px;height:9px;border-radius:2px;background:var(--red)' }), 'Exp']),
        ]));
        const chart = el('div.card-pad', { style: 'display:flex;align-items:flex-end;gap:6px;height:170px;padding-top:18px' });
        months.forEach(k => {
          const rv = revByMonth[k] || 0, ev = expByMonth[k] || 0;
          chart.appendChild(el('div', { style: 'flex:1;display:flex;flex-direction:column;align-items:center;gap:4px;height:100%;justify-content:flex-end' }, [
            el('div', { style: 'display:flex;align-items:flex-end;gap:2px;height:100%;width:100%;justify-content:center' }, [
              el('div', { title: 'Revenue ' + UI.fmtMoney(rv), style: `width:42%;background:var(--green);border-radius:4px 4px 0 0;height:${(rv / maxVal * 100).toFixed(1)}%;min-height:${rv > 0 ? '3px' : '0'}` }),
              el('div', { title: 'Expenses ' + UI.fmtMoney(ev), style: `width:42%;background:var(--red);opacity:.85;border-radius:4px 4px 0 0;height:${(ev / maxVal * 100).toFixed(1)}%;min-height:${ev > 0 ? '3px' : '0'}` }),
            ]),
            el('div', { class: 'muted', style: 'font-size:10px;font-weight:600', text: monthLabel(k) }),
          ]));
        });
        chartCard.appendChild(chart);
        body.appendChild(chartCard);

        // recent payments
        const recents = paidInv.filter(i => inRange(i.issueDate))
          .sort((a, b) => (b.issueDate || '').localeCompare(a.issueDate || '')).slice(0, 8);
        if (recents.length) {
          const card = el('div.card');
          card.appendChild(el('div.card-head', [UI.icon('money'), el('h3', 'Recent revenue')]));
          const list = el('div.list');
          recents.forEach(async i => {
            const name = await App.customerName(i.customerId);
            list.appendChild(el('div.row', { onClick: () => Router.go('invoices', { id: i.id }) }, [
              el('div.qi.tint-green', { style: 'width:34px;height:34px;flex:none' }, [UI.icon('check')]),
              el('div.grow', [el('div.t1', { text: name }), el('div.t2', { text: `${i.number} · ${UI.fmtDate(i.issueDate)}` })]),
              el('div.amt', { text: UI.fmtMoney(i.amountPaid || 0) }),
            ]));
          });
          card.appendChild(list);
          body.appendChild(card);
        }

        body.appendChild(el('button.btn.btn-ghost.btn-block', { style: 'margin-top:14px', onClick: () => exportCSV(paidInv, receipts) }, [UI.icon('download'), 'Export financials (CSV)']));
      }

      function kpi(label, value, color, icon) {
        return el('div.stat', [
          el('div', { style: 'display:flex;align-items:center;gap:8px;margin-bottom:6px' }, [
            el('div.qi.tint-' + (color === 'red' ? 'amber' : color), { style: 'width:28px;height:28px;flex:none' }, [UI.icon(icon)]),
            el('div.label', { text: label }),
          ]),
          el('div.value', { style: color === 'red' ? 'color:var(--red)' : '', text: value }),
        ]);
      }

      async function exportCSV(paidInv, receipts) {
        const rows = [['Type', 'Date', 'Number/Vendor', 'Customer/Category', 'Amount']];
        for (const i of paidInv) rows.push(['Revenue', i.issueDate, i.number || '', await App.customerName(i.customerId), (i.amountPaid || 0).toFixed(2)]);
        receipts.forEach(r => rows.push(['Expense', r.date, r.vendor || '', r.category || '', '-' + (r.amount || 0).toFixed(2)]));
        const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
        a.download = 'flowmaster-financials.csv'; a.click(); URL.revokeObjectURL(a.href);
        UI.toast('CSV exported');
      }

      render();
    },
  });
})();
