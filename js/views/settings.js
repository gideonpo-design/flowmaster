/* ==========================================================================
   views/settings.js — Settings (fully functional in Step 1)
   Business profile, invoicing defaults, technicians, appearance, and
   data backup/restore. Everything here feeds the rest of the app and its PDFs.
   ========================================================================== */

Router.register('settings', {
  title: 'Settings',
  async render(view) {
    const { el } = UI;
    let s = await DB.settings();

    // small helper to build a labeled input bound to a settings key
    const draft = { ...s };
    const field = (label, key, opts = {}) => {
      const id = 'set_' + key;
      const input = opts.type === 'textarea'
        ? el('textarea.textarea', { id, value: draft[key] ?? '' })
        : opts.type === 'select'
          ? el('select.select', { id }, (opts.options || []).map(o =>
              el('option', { value: o.value, selected: String(draft[key]) === String(o.value) }, o.label)))
          : el('input.input', { id, type: opts.type || 'text', value: draft[key] ?? '',
              inputmode: opts.inputmode, placeholder: opts.placeholder || '' });
      input.addEventListener('input', () => {
        draft[key] = opts.type === 'number' ? Number(input.value) : input.value;
      });
      if (opts.type === 'select')
        input.addEventListener('change', () => { draft[key] = input.value; });
      return el('div.field' + (opts.half ? '' : ''), [ el('label', { for: id, text: label }), input ]);
    };

    const row2 = (a, b) => el('div', { style: 'display:grid;grid-template-columns:1fr 1fr;gap:12px' }, [a, b]);

    const section = (icon, title, children) => {
      const card = el('div.card', { style: 'margin-bottom:16px' });
      card.appendChild(el('div.card-head', [UI.icon(icon), el('h3', { text: title })]));
      card.appendChild(el('div.card-pad', children));
      return card;
    };

    // ---- Business profile ----
    view.appendChild(section('settings', 'Business profile', [
      field('Business name', 'businessName'),
      field('Slogan', 'slogan'),
      field('Street address', 'address'),
      row2(field('City', 'city'), field('State', 'state')),
      row2(field('ZIP', 'zip', { inputmode: 'numeric' }), field('Phone', 'phone', { type: 'tel' })),
      row2(field('Email', 'email', { type: 'email' }), field('Website', 'website')),
    ]));

    // ---- Invoicing defaults ----
    view.appendChild(section('invoice', 'Invoicing & estimates', [
      row2(
        field('Tax rate (%)', 'taxRate', { type: 'number', inputmode: 'decimal' }),
        el('div'),
      ),
      row2(field('Invoice prefix', 'invoicePrefix'), field('Next invoice #', 'invoiceStart', { type: 'number', inputmode: 'numeric' })),
      row2(field('Estimate prefix', 'estimatePrefix'), field('Next estimate #', 'estimateStart', { type: 'number', inputmode: 'numeric' })),
      field('Default invoice terms', 'invoiceTerms', { type: 'textarea' }),
      field('Thank-you message', 'thankYou'),
    ]));

    // ---- Technicians ----
    const techCard = el('div.card', { style: 'margin-bottom:16px' });
    techCard.appendChild(el('div.card-head', [UI.icon('customers'), el('h3', { text: 'Technicians' })]));
    const techBody = el('div.card-pad');
    techCard.appendChild(techBody);
    function renderTechs() {
      UI.clear(techBody);
      const list = el('div', { style: 'display:flex;flex-wrap:wrap;gap:8px;margin-bottom:12px' });
      (draft.technicians || []).forEach((t, i) => {
        list.appendChild(el('span.pill.sky', { style: 'padding:6px 10px' }, [
          el('span', { text: t }),
          el('button', { style: 'background:none;border:none;cursor:pointer;color:inherit;padding:0;margin-left:2px;display:flex',
            'aria-label': 'Remove ' + t,
            onClick: () => { draft.technicians.splice(i, 1); renderTechs(); } }, [UI.icon('x')]),
        ]));
      });
      if (!(draft.technicians || []).length)
        list.appendChild(el('span.muted', { style: 'font-size:13px', text: 'No technicians added yet.' }));
      const input = el('input.input', { placeholder: 'Add technician name', style: 'flex:1' });
      const add = () => { const v = input.value.trim(); if (!v) return;
        draft.technicians = [...(draft.technicians || []), v]; renderTechs(); };
      input.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); add(); } });
      techBody.appendChild(list);
      techBody.appendChild(el('div', { style: 'display:flex;gap:8px' }, [
        input, el('button.btn.btn-ghost', { onClick: () => { add(); techBody.querySelector('input').focus(); } }, [UI.icon('plus'), 'Add']),
      ]));
    }
    renderTechs();
    view.appendChild(techCard);

    // ---- Appearance ----
    view.appendChild(section('moon', 'Appearance', [
      field('Theme', 'theme', { type: 'select', options: [
        { value: 'system', label: 'Match device' },
        { value: 'light', label: 'Light' },
        { value: 'dark', label: 'Dark' },
      ] }),
    ]));

    // ---- Save bar ----
    view.appendChild(el('div', { style: 'display:flex;gap:10px;margin:4px 0 22px' }, [
      el('button.btn.btn-primary.btn-block', { onClick: async () => {
        await DB.saveSettings(draft);
        s = await DB.settings();
        // re-apply theme + refresh brand text without full reload
        document.dispatchEvent(new CustomEvent('settings-saved'));
        applyThemeSafe(draft.theme);
        refreshBrand(draft.businessName);
        UI.toast('Settings saved');
      } }, [UI.icon('check'), 'Save changes']),
    ]));

    // ---- Data & backup ----
    const dataCard = el('div.card', { style: 'margin-bottom:16px' });
    dataCard.appendChild(el('div.card-head', [UI.icon('download'), el('h3', { text: 'Data & backup' })]));
    const fileInput = el('input', { type: 'file', accept: 'application/json', style: 'display:none' });
    fileInput.addEventListener('change', async () => {
      const file = fileInput.files[0]; if (!file) return;
      try {
        const payload = JSON.parse(await file.text());
        const merge = await UI.confirm({ title: 'Restore backup',
          message: 'Choose "Merge" to add this data alongside what you have, or "Cancel" then use Replace. Merging keeps existing records.',
          confirmLabel: 'Merge in' });
        await DB.importAll(payload, { merge });
        UI.toast('Backup restored');
        Router.go('settings');
      } catch (e) { UI.toast('Could not read that file', 'err'); }
      fileInput.value = '';
    });
    dataCard.appendChild(el('div.card-pad', [
      el('p', { class: 'muted', style: 'font-size:13px;line-height:1.5;margin-bottom:14px',
        text: 'Everything lives on this device. Export a backup file regularly — especially before switching phones or browsers.' }),
      el('div', { style: 'display:grid;gap:10px' }, [
        el('button.btn.btn-ghost.btn-block', { onClick: async () => {
          const data = await DB.exportAll();
          const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
          const a = el('a', { href: URL.createObjectURL(blob),
            download: `flowmaster-backup-${new Date().toISOString().slice(0,10)}.json` });
          document.body.appendChild(a); a.click(); a.remove();
          UI.toast('Backup downloaded');
        } }, [UI.icon('download'), 'Export backup (.json)']),
        el('button.btn.btn-ghost.btn-block', { onClick: () => fileInput.click() },
          [UI.icon('inbox'), 'Restore from backup']),
        fileInput,
        el('button.btn.btn-subtle.btn-block', { style: 'color:var(--red)', onClick: async () => {
          const ok = await UI.confirm({ title: 'Erase all data?', danger: true, confirmLabel: 'Erase everything',
            message: 'This permanently clears every customer, invoice, job, and setting on this device. Export a backup first.' });
          if (!ok) return;
          for (const store of DB._stores) await DB.clear(store);
          UI.toast('All data erased');
          location.reload();
        } }, [UI.icon('alert'), 'Erase all data']),
      ]),
    ]));
    view.appendChild(dataCard);

    // ---- About ----
    view.appendChild(el('div.card.card-pad', { style: 'text-align:center' }, [
      el('div', { class: 'muted', style: 'font-size:12.5px;line-height:1.6' }, [
        el('div', { style: 'font-weight:700;color:var(--ink)', text: draft.businessName || 'FlowMaster' }),
        el('div', { text: 'Business Management · Step 1 foundation' }),
        el('div', { text: navigator.onLine ? 'Online · data stored locally' : 'Offline · data stored locally' }),
      ]),
    ]));

    // helpers that touch the shell live in app.js scope; guard if absent
    function applyThemeSafe(mode) { if (window.applyTheme) window.applyTheme(mode); }
    function refreshBrand(name) {
      const short = (name || 'FlowMaster').split(' ')[0];
      document.querySelectorAll('.sidebar-brand .name, .brand-mobile div').forEach(n => {
        n.innerHTML = esc(short) + '<span>' + esc((name || '').slice(short.length)) + '</span>';
      });
    }
    function esc(t = '') { return String(t).replace(/[&<>"]/g,
      c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
  },
});
