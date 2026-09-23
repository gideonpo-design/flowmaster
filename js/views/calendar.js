/* ==========================================================================
   views/calendar.js — Job Scheduling & Calendar
   Views: Month · Week · Agenda · Today (route). Color-coded statuses,
   drag-to-reschedule (month), recurring jobs, click-to-call & maps links,
   convert job → invoice, and Seasonal Recall.
   ========================================================================== */
(function () {
  const { el } = UI;
  const TYPES = ['Startup', 'Winterization', 'Repair', 'Inspection', 'Installation', 'Controller', 'Backflow Test', 'Maintenance', 'Estimate', 'Other'];
  const PRIORITIES = ['low', 'normal', 'high'];
  const todayStr = () => new Date().toISOString().slice(0, 10);
  const iso = (d) => d.toISOString().slice(0, 10);
  const parse = (s) => new Date(s + 'T00:00:00');
  const STATUS_COLOR = { scheduled: 'sky', confirmed: 'teal', inprogress: 'amber',
    completed: 'green', waiting: 'violet', cancelled: 'slate', estimate: 'slate' };

  let viewMode = 'month';
  let cursor = new Date();   // anchor date for month/week

  Router.register('calendar', {
    title: 'Calendar',
    async render(view, params) {
      if (params.newFor || params.new) { await openEditor(null, { customerId: params.newFor, date: params.date }); }
      if (params.id) { const j = await DB.get('jobs', params.id); if (j) await openEditor(j); }
      if (params.recall) return renderRecall(view);
      return shell(view);
    },
  });

  async function shell(view) {
    const jobs = await DB.all('jobs');
    const customers = await App.customers();
    const nameOf = (id) => { const c = customers.find(x => x.id === id); return c ? c.name : 'Customer'; };

    // header: view switcher + new + recall
    view.appendChild(el('div', { style: 'display:flex;align-items:center;gap:8px;margin-bottom:12px;flex-wrap:wrap' }, [
      el('h1', { style: 'font-size:21px;font-weight:800;letter-spacing:-.4px;flex:1', text: 'Schedule' }),
      el('button.btn.btn-ghost.btn-sm', { onClick: () => Router.go('calendar', { recall: 1 }) }, [UI.icon('bell'), el('span.desktop-only', 'Recall')]),
      el('button.btn.btn-primary.btn-sm', { onClick: () => openEditor(null, {}, () => Router.go('calendar')) }, [UI.icon('plus'), el('span.desktop-only', 'New job')]),
    ]));

    const switcher = el('div', { style: 'display:flex;gap:4px;background:var(--surface-2);padding:4px;border-radius:12px;margin-bottom:14px;width:max-content' },
      [['month', 'Month'], ['week', 'Week'], ['agenda', 'Agenda'], ['today', 'Today']].map(([k, label]) =>
        el('button.btn.btn-sm', { class: k === viewMode ? 'btn-primary' : 'btn-subtle', style: 'box-shadow:none;border:none;background:' + (k === viewMode ? '' : 'transparent'),
          onClick: () => { viewMode = k; rerender(); } }, label)));
    view.appendChild(switcher);

    const body = el('div');
    view.appendChild(body);

    function rerender() {
      // refresh switcher active states
      switcher.querySelectorAll('button').forEach((b, i) => {
        const k = ['month', 'week', 'agenda', 'today'][i];
        b.className = 'btn btn-sm ' + (k === viewMode ? 'btn-primary' : 'btn-subtle');
        if (k !== viewMode) b.style.background = 'transparent';
      });
      UI.clear(body);
      if (viewMode === 'month') month(body);
      else if (viewMode === 'week') week(body);
      else if (viewMode === 'agenda') agenda(body);
      else todayRoute(body);
    }

    async function reload() { const fresh = await DB.all('jobs'); jobs.length = 0; jobs.push(...fresh); rerender(); }

    /* ---- Month ---- */
    function month(mount) {
      const y = cursor.getFullYear(), m = cursor.getMonth();
      const first = new Date(y, m, 1), startDow = first.getDay();
      const daysInMonth = new Date(y, m + 1, 0).getDate();
      const monthJobs = {};
      jobs.forEach(j => { if (j.status !== 'cancelled') (monthJobs[j.date] ||= []).push(j); });

      mount.appendChild(navBar(
        cursor.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
        () => { cursor = new Date(y, m - 1, 1); rerender(); },
        () => { cursor = new Date(y, m + 1, 1); rerender(); },
        () => { cursor = new Date(); rerender(); }));

      const grid = el('div.card', { style: 'padding:8px;overflow:hidden' });
      const week = el('div', { style: 'display:grid;grid-template-columns:repeat(7,1fr);gap:4px' });
      ['S', 'M', 'T', 'W', 'T', 'F', 'S'].forEach(d => week.appendChild(
        el('div', { class: 'muted', style: 'text-align:center;font-size:11px;font-weight:700;padding:4px 0', text: d })));
      grid.appendChild(week);

      const cells = el('div', { style: 'display:grid;grid-template-columns:repeat(7,1fr);gap:4px;margin-top:4px' });
      for (let i = 0; i < startDow; i++) cells.appendChild(el('div'));
      for (let d = 1; d <= daysInMonth; d++) {
        const dateStr = iso(new Date(y, m, d));
        const dayJobs = (monthJobs[dateStr] || []).sort((a, b) => (a.startTime || '').localeCompare(b.startTime || ''));
        const isToday = dateStr === todayStr();
        const cell = el('div', { style: `min-height:78px;border-radius:10px;padding:4px;background:var(--surface-2);cursor:pointer;border:1.5px solid ${isToday ? 'var(--brand-400)' : 'transparent'};display:flex;flex-direction:column;gap:2px;overflow:hidden`,
          onClick: () => openEditor(null, { date: dateStr }, reload),
          ondragover: (e) => { e.preventDefault(); cell.style.background = 'var(--brand-50)'; },
          ondragleave: () => { cell.style.background = 'var(--surface-2)'; },
          ondrop: async (e) => { e.preventDefault(); cell.style.background = 'var(--surface-2)';
            const jid = e.dataTransfer.getData('text/jid'); if (!jid) return;
            const job = jobs.find(x => x.id === jid); if (job && job.date !== dateStr) { job.date = dateStr; await DB.put('jobs', job); UI.toast('Rescheduled'); reload(); } } });
        cell.appendChild(el('div', { style: `font-size:12px;font-weight:700;${isToday ? 'color:var(--brand-600)' : ''}`, text: String(d) }));
        dayJobs.slice(0, 3).forEach(j => {
          const color = STATUS_COLOR[j.status] || 'sky';
          const chip = el('div', { class: 'pill ' + color, draggable: 'true',
            style: 'font-size:10px;padding:2px 6px;border-radius:6px;width:100%;justify-content:flex-start;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;display:block',
            onClick: (e) => { e.stopPropagation(); openEditor(j, {}, reload); },
            ondragstart: (e) => { e.dataTransfer.setData('text/jid', j.id); } },
            (j.startTime ? UI.fmtTime(j.startTime).replace(':00', '') + ' ' : '') + (j.title || j.type || 'Job'));
          cell.appendChild(chip);
        });
        if (dayJobs.length > 3) cell.appendChild(el('div', { class: 'muted', style: 'font-size:10px;font-weight:600', text: `+${dayJobs.length - 3} more` }));
        cells.appendChild(cell);
      }
      grid.appendChild(cells);
      mount.appendChild(grid);
      mount.appendChild(legend());
    }

    /* ---- Week ---- */
    function week(mount) {
      const base = new Date(cursor); base.setDate(base.getDate() - base.getDay());
      const days = Array.from({ length: 7 }, (_, i) => { const d = new Date(base); d.setDate(base.getDate() + i); return d; });
      mount.appendChild(navBar(
        `${days[0].toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${days[6].toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`,
        () => { cursor = new Date(base.getFullYear(), base.getMonth(), base.getDate() - 7); rerender(); },
        () => { cursor = new Date(base.getFullYear(), base.getMonth(), base.getDate() + 7); rerender(); },
        () => { cursor = new Date(); rerender(); }));
      days.forEach(d => {
        const dateStr = iso(d);
        const dayJobs = jobs.filter(j => j.date === dateStr && j.status !== 'cancelled')
          .sort((a, b) => (a.startTime || '').localeCompare(b.startTime || ''));
        const isToday = dateStr === todayStr();
        const card = el('div.card', { style: 'margin-bottom:10px' });
        card.appendChild(el('div.card-head', { style: 'cursor:pointer', onClick: () => openEditor(null, { date: dateStr }, reload) }, [
          el('h3', { style: isToday ? 'color:var(--brand-600)' : '', text: d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' }) }),
          el('div.spacer'), el('button.btn.btn-subtle.btn-sm', [UI.icon('plus')]),
        ]));
        if (dayJobs.length) { const list = el('div.list'); dayJobs.forEach(j => list.appendChild(jobRow(j, nameOf, reload))); card.appendChild(list); }
        else card.appendChild(el('div.card-pad', [el('p', { class: 'muted', style: 'font-size:13px', text: 'No jobs' })]));
        mount.appendChild(card);
      });
    }

    /* ---- Agenda ---- */
    function agenda(mount) {
      const upcoming = jobs.filter(j => j.date >= todayStr() && j.status !== 'cancelled' && j.status !== 'completed')
        .sort((a, b) => (a.date + (a.startTime || '')).localeCompare(b.date + (b.startTime || '')));
      if (!upcoming.length) { mount.appendChild(UI.empty({ icon: 'calendar', title: 'Nothing scheduled',
        text: 'Upcoming jobs will appear here.', action: { label: 'New job', onClick: () => openEditor(null, {}, reload) } })); return; }
      const byDate = {}; upcoming.forEach(j => (byDate[j.date] ||= []).push(j));
      Object.keys(byDate).sort().forEach(date => {
        mount.appendChild(el('div.section-title', [UI.relDate(date) + ' · ' + UI.fmtDate(date, { weekday: 'short', month: 'short', day: 'numeric' })]));
        const card = el('div.card'); const list = el('div.list');
        byDate[date].sort((a, b) => (a.startTime || '').localeCompare(b.startTime || ''))
          .forEach(j => list.appendChild(jobRow(j, nameOf, reload)));
        card.appendChild(list); mount.appendChild(card);
      });
    }

    /* ---- Today's route ---- */
    function todayRoute(mount) {
      const list = jobs.filter(j => j.date === todayStr() && j.status !== 'cancelled')
        .sort((a, b) => (a.startTime || '').localeCompare(b.startTime || ''));
      mount.appendChild(el('div.card.card-pad', { style: 'margin-bottom:14px;text-align:center' }, [
        el('div.muted', { style: 'font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.04em', text: "Today's Route" }),
        el('h2', { style: 'font-size:20px;font-weight:800;margin-top:4px', text: `${list.length} stop${list.length === 1 ? '' : 's'}` }),
        el('div.muted', { style: 'font-size:13px', text: new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }) }),
      ]));
      if (!list.length) { mount.appendChild(UI.empty({ icon: 'route', title: 'No stops today', text: 'Enjoy the day off — or schedule a job.' })); return; }
      list.forEach((j, i) => {
        const c = customers.find(x => x.id === j.customerId);
        const addr = j.serviceAddress || (c && (c.serviceAddress || c.billingAddress)) || '';
        const card = el('div.card', { style: 'margin-bottom:10px' });
        card.appendChild(el('div.card-pad', [
          el('div', { style: 'display:flex;gap:12px;align-items:flex-start' }, [
            el('div.qi.tint-sky', { style: 'width:34px;height:34px;flex:none;font-weight:800', text: String(i + 1) }),
            el('div', { style: 'flex:1;min-width:0' }, [
              el('div', { style: 'display:flex;justify-content:space-between;gap:8px' }, [
                el('div.t1', { style: 'font-weight:700', text: j.title || j.type || 'Job' }),
                UI.pill(UI.JOB_STATUS, j.status) ]),
              el('div.muted', { style: 'font-size:13px;margin-top:2px', text: [j.startTime && UI.fmtTime(j.startTime), c && c.name].filter(Boolean).join(' · ') }),
              addr && el('div.muted', { style: 'font-size:12.5px;margin-top:2px', text: addr }),
            ]),
          ]),
          el('div', { style: 'display:flex;gap:8px;margin-top:10px;flex-wrap:wrap' }, [
            c && c.phone && el('a.btn.btn-subtle.btn-sm', { href: 'tel:' + c.phone }, [UI.icon('customers'), 'Call']),
            addr && el('a.btn.btn-subtle.btn-sm', { href: 'https://maps.apple.com/?q=' + encodeURIComponent(addr), target: '_blank' }, [UI.icon('route'), 'Apple Maps']),
            addr && el('a.btn.btn-subtle.btn-sm', { href: 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(addr), target: '_blank' }, [UI.icon('route'), 'Google']),
            el('button.btn.btn-subtle.btn-sm', { onClick: () => openEditor(j, {}, reload) }, [UI.icon('settings'), 'Edit']),
            j.status !== 'completed' && el('button.btn.btn-ghost.btn-sm', { onClick: async () => { j.status = 'completed'; await DB.put('jobs', j); UI.toast('Marked complete'); reload(); } }, [UI.icon('check'), 'Complete']),
          ]),
        ]));
        mount.appendChild(card);
      });
    }

    function jobRow(j, nameOf, reload) {
      return el('div.row', { onClick: () => openEditor(j, {}, reload) }, [
        el('div', { style: `width:4px;align-self:stretch;border-radius:3px;background:var(--${STATUS_COLOR[j.status] === 'sky' ? 'sky' : STATUS_COLOR[j.status]})` }),
        el('div.avatar', { style: 'font-size:11px', text: j.startTime ? UI.fmtTime(j.startTime).replace(/\s?[AP]M/, '') : '—' }),
        el('div.grow', [ el('div.t1', { text: j.title || j.type || 'Job' }),
          el('div.t2', { text: [nameOf(j.customerId), j.serviceAddress].filter(Boolean).join(' · ') }) ]),
        UI.pill(UI.JOB_STATUS, j.status),
      ]);
    }

    function navBar(label, prev, next, today) {
      return el('div', { style: 'display:flex;align-items:center;gap:8px;margin-bottom:12px' }, [
        el('button.icon-btn', { onClick: prev, style: 'transform:rotate(180deg)' }, [UI.icon('chevron')]),
        el('h2', { style: 'font-size:17px;font-weight:800;flex:1;text-align:center', text: label }),
        el('button.btn.btn-subtle.btn-sm', { onClick: today }, 'Today'),
        el('button.icon-btn', { onClick: next }, [UI.icon('chevron')]),
      ]);
    }

    function legend() {
      return el('div', { style: 'display:flex;gap:10px;flex-wrap:wrap;margin-top:12px;justify-content:center' },
        Object.entries(UI.JOB_STATUS).filter(([k]) => k !== 'estimate').map(([k, v]) =>
          el('span', { style: 'display:flex;align-items:center;gap:5px;font-size:11px;color:var(--muted)' }, [
            el('span', { style: `width:9px;height:9px;border-radius:3px;background:var(--${STATUS_COLOR[k]})` }), v.label ])));
    }

    rerender();
  }

  /* ---- job editor ------------------------------------------------------- */
  async function openEditor(existing, defaults = {}, after) {
    const settings = await DB.settings();
    const j = existing ? { ...existing } : {
      customerId: defaults.customerId || '', title: '', type: 'Repair',
      date: defaults.date || todayStr(), startTime: '09:00', duration: 60,
      technician: (settings.technicians || [])[0] || '', priority: 'normal',
      status: 'scheduled', serviceAddress: '', notes: '', recurring: null,
    };
    const cs = App.customerSelect(j.customerId, async id => { j.customerId = id;
      const c = id ? await App.customer(id) : null;
      if (c && !j.serviceAddress) { addr.value = c.serviceAddress || c.billingAddress || ''; j.serviceAddress = addr.value; } });
    const title = el('input.input', { value: j.title, placeholder: 'e.g. Spring startup — 8 zones' });
    title.addEventListener('input', () => j.title = title.value);
    const type = el('select.select', TYPES.map(t => el('option', { value: t, selected: t === j.type }, t)));
    type.addEventListener('change', () => j.type = type.value);
    const date = el('input.input', { type: 'date', value: j.date }); date.addEventListener('change', () => j.date = date.value);
    const time = el('input.input', { type: 'time', value: j.startTime }); time.addEventListener('change', () => j.startTime = time.value);
    const dur = el('input.input', { type: 'number', value: j.duration, inputmode: 'numeric' }); dur.addEventListener('input', () => j.duration = parseInt(dur.value) || 0);
    const tech = el('select.select', [el('option', { value: '' }, '—')].concat((settings.technicians || []).map(t => el('option', { value: t, selected: t === j.technician }, t))));
    tech.addEventListener('change', () => j.technician = tech.value);
    const status = el('select.select', Object.entries(UI.JOB_STATUS).map(([k, v]) => el('option', { value: k, selected: k === j.status }, v.label)));
    status.addEventListener('change', () => j.status = status.value);
    const priority = el('select.select', PRIORITIES.map(p => el('option', { value: p, selected: p === j.priority }, p[0].toUpperCase() + p.slice(1))));
    priority.addEventListener('change', () => j.priority = priority.value);
    const addr = el('input.input', { value: j.serviceAddress, placeholder: 'Service address' });
    addr.addEventListener('input', () => j.serviceAddress = addr.value);
    const notes = el('textarea.textarea', { value: j.notes, placeholder: 'Notes' });
    notes.addEventListener('input', () => j.notes = notes.value);

    // recurring
    const recOn = el('input', { type: 'checkbox', checked: !!j.recurring, style: 'width:18px;height:18px' });
    const recFreq = el('select.select', [['weekly', 'Weekly'], ['biweekly', 'Every 2 weeks'], ['monthly', 'Monthly'], ['yearly', 'Yearly']].map(([v, l]) => el('option', { value: v, selected: j.recurring && j.recurring.freq === v }, l)));
    const recCount = el('input.input', { type: 'number', value: (j.recurring && j.recurring.count) || 4, inputmode: 'numeric', min: '1' });
    const recRow = el('div', { style: 'display:' + (j.recurring ? 'grid' : 'none') + ';grid-template-columns:1fr 90px;gap:10px;margin-top:8px' }, [
      el('div.field', { style: 'margin:0' }, [el('label', 'Repeats'), recFreq]),
      el('div.field', { style: 'margin:0' }, [el('label', 'Count'), recCount]),
    ]);
    recOn.addEventListener('change', () => recRow.style.display = recOn.checked ? 'grid' : 'none');

    const row2 = (a, b) => el('div', { style: 'display:grid;grid-template-columns:1fr 1fr;gap:12px' }, [a, b]);
    const body = el('div', [
      el('div.field', [el('label', 'Customer'), cs.node]),
      el('div.field', [el('label', 'Job title'), title]),
      row2(el('div.field', [el('label', 'Type'), type]), el('div.field', [el('label', 'Status'), status])),
      row2(el('div.field', [el('label', 'Date'), date]), el('div.field', [el('label', 'Start time'), time])),
      row2(el('div.field', [el('label', 'Duration (min)'), dur]), el('div.field', [el('label', 'Priority'), priority])),
      row2(el('div.field', [el('label', 'Technician'), tech]), el('div.field', [el('label', 'Service address'), addr])),
      el('div.field', [el('label', 'Notes'), notes]),
      el('label', { class: 'flex center gap-8', style: 'cursor:pointer;font-size:14px;font-weight:600;margin-top:4px' }, [recOn, 'Recurring job']),
      recRow,
    ]);

    const actions = [
      existing && { label: 'Delete', kind: 'danger', onClick: async () => {
        await DB.remove('jobs', existing.id); UI.toast('Job deleted'); after && after(); } },
      existing && j.customerId && { label: 'To invoice', kind: 'subtle', onClick: async () => {
        j.status = 'completed'; await DB.put('jobs', j); Router.go('invoices', { newFor: j.customerId }); } },
      { label: 'Cancel', kind: 'ghost' },
      { label: existing ? 'Save' : 'Schedule', kind: 'primary', onClick: async () => {
        if (!cs.value()) { UI.toast('Choose a customer', 'err'); return false; }
        j.customerId = cs.value();
        j.recurring = recOn.checked ? { freq: recFreq.value, count: parseInt(recCount.value) || 1 } : null;
        const id = await DB.put('jobs', j);
        // generate recurring instances (future copies)
        if (!existing && j.recurring) {
          let d = j.date;
          for (let i = 1; i < j.recurring.count; i++) {
            d = App.addInterval(d, j.recurring.freq, 1);
            await DB.put('jobs', { ...j, id: undefined, date: d, recurring: null, parentId: id });
          }
        }
        UI.toast(existing ? 'Job saved' : 'Job scheduled'); after && after();
      } },
    ].filter(Boolean);

    UI.modal({ title: existing ? 'Edit job' : 'New job', body, actions, onClose: () => {} });
  }

  /* ---- Seasonal Recall -------------------------------------------------- */
  async function renderRecall(view) {
    const jobs = await DB.all('jobs');
    const customers = await App.customers();
    const yearAgo = (() => { const d = new Date(); d.setFullYear(d.getFullYear() - 1); return iso(d); })();
    const nowYear = new Date().getFullYear();

    view.appendChild(el('div', { style: 'display:flex;align-items:center;gap:8px;margin-bottom:6px' }, [
      el('button.btn.btn-subtle.btn-sm', { onClick: () => Router.go('calendar') }, '← Calendar'),
      el('h1', { style: 'font-size:21px;font-weight:800;flex:1', text: 'Seasonal Recall' }),
    ]));
    view.appendChild(el('p', { class: 'muted', style: 'font-size:13.5px;margin-bottom:16px;line-height:1.5',
      text: 'Customers due for recurring seasonal service based on last year’s jobs. Schedule the next visit in one tap.' }));

    // build: for each customer with a past Startup/Winterization, suggest this year's
    const suggestions = [];
    const seasonals = [['Startup', 'Spring Startup', 'spring'], ['Winterization', 'Winterization', 'fall']];
    customers.forEach(c => {
      seasonals.forEach(([type, label]) => {
        const past = jobs.filter(j => j.customerId === c.id && j.type === type).sort((a, b) => b.date.localeCompare(a.date));
        if (!past.length) return;
        const last = past[0];
        const lastYear = parse(last.date).getFullYear();
        const doneThisYear = past.some(j => parse(j.date).getFullYear() === nowYear);
        if (!doneThisYear && lastYear < nowYear + 1) {
          suggestions.push({ customer: c, type, label, last: last.date });
        }
      });
    });

    if (!suggestions.length) {
      view.appendChild(UI.empty({ icon: 'bell', title: 'Nothing due right now',
        text: 'As jobs are completed, customers due for their next seasonal service will show up here.' }));
      return;
    }
    const card = el('div.card'); const list = el('div.list');
    suggestions.sort((a, b) => a.last.localeCompare(b.last)).forEach(s => {
      list.appendChild(el('div.row', { style: 'cursor:default' }, [
        el('div.qi.' + (s.type === 'Startup' ? 'tint-green' : 'tint-sky'), { style: 'width:36px;height:36px;flex:none' }, [UI.icon(s.type === 'Startup' ? 'sun' : 'moon')]),
        el('div.grow', [ el('div.t1', { text: s.customer.name }),
          el('div.t2', { text: `${s.label} · last done ${UI.fmtDate(s.last)}` }) ]),
        el('button.btn.btn-primary.btn-sm', { onClick: () => openEditor(null, { customerId: s.customer.id }, () => Router.go('calendar', { recall: 1 })) }, [UI.icon('plus'), 'Schedule']),
      ]));
    });
    card.appendChild(list); view.appendChild(card);
  }
})();
