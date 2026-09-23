/* ==========================================================================
   views/emails.js — Email Center
   Auto-draft professional emails (invoice, estimate, payment reminder, payment
   received, overdue notice, follow-up, seasonal recall). Compose, copy, open in
   mail app, and keep a log of drafts/sent.
   Route: #/emails  ·  #/emails?compose=TYPE&ref=ID
   ========================================================================== */
(function () {
  const { el } = UI;
  const money = (n) => UI.fmtMoney(n);
  const date = (d) => UI.fmtDate(d);

  const TEMPLATES = {
    invoice:   { label: 'Send invoice',      icon: 'invoice',  needs: 'invoice' },
    estimate:  { label: 'Send estimate',     icon: 'estimate', needs: 'estimate' },
    reminder:  { label: 'Payment reminder',  icon: 'clock',    needs: 'invoice' },
    overdue:   { label: 'Overdue notice',    icon: 'alert',    needs: 'invoice' },
    received:  { label: 'Payment received',  icon: 'check',    needs: 'invoice' },
    followup:  { label: 'Job follow-up',     icon: 'email',    needs: 'customer' },
    recall:    { label: 'Seasonal reminder', icon: 'bell',     needs: 'customer' },
  };

  async function generate(type, ctx) {
    const s = ctx.settings, biz = s.businessName || 'FlowMaster Irrigation Services';
    const c = ctx.customer, doc = ctx.doc;
    const first = (c && c.name ? c.name.split(' ')[0] : 'there');
    const sign = `\n\nThank you,\n${s.ownerName || biz}\n${biz}${s.phone ? '\n' + s.phone : ''}`;
    const T = {
      invoice: () => ({
        subject: `Invoice ${doc.number} from ${biz}`,
        body: `Hi ${first},\n\nThank you for choosing ${biz}. Please find your invoice ${doc.number} for ${money(doc.total)} attached.\n\nAmount due: ${money((doc.total || 0) - (doc.amountPaid || 0))}\nDue date: ${date(doc.dueDate)}\n\nWe appreciate your business and are always here if you have any questions about your irrigation system.${sign}`,
      }),
      estimate: () => ({
        subject: `Your estimate ${doc.number} from ${biz}`,
        body: `Hi ${first},\n\nThanks for the opportunity to quote your irrigation work. Your estimate ${doc.number} comes to ${money(doc.total)}${doc.expiryDate ? `, valid through ${date(doc.expiryDate)}` : ''}.\n\nJust reply to this email or give us a call to get on the schedule — we'd be glad to take care of it.${sign}`,
      }),
      reminder: () => ({
        subject: `Friendly reminder: invoice ${doc.number}`,
        body: `Hi ${first},\n\nA quick reminder that invoice ${doc.number} for ${money((doc.total || 0) - (doc.amountPaid || 0))} is due ${date(doc.dueDate)}. If you've already sent payment, thank you and please disregard this note.\n\nLet us know if there's anything we can help with.${sign}`,
      }),
      overdue: () => ({
        subject: `Past due: invoice ${doc.number}`,
        body: `Hi ${first},\n\nOur records show invoice ${doc.number} for ${money((doc.total || 0) - (doc.amountPaid || 0))} was due on ${date(doc.dueDate)} and is now past due. We'd appreciate your payment at your earliest convenience.\n\nIf you have any questions about the invoice or would like to arrange payment, please reach out — we're happy to help.${sign}`,
      }),
      received: () => ({
        subject: `Payment received — invoice ${doc.number}`,
        body: `Hi ${first},\n\nThis confirms we've received your payment of ${money(doc.amountPaid)} for invoice ${doc.number}. Thank you!\n\nWe appreciate your business and look forward to keeping your system running beautifully.${sign}`,
      }),
      followup: () => ({
        subject: `How is everything with your irrigation system?`,
        body: `Hi ${first},\n\nThank you again for trusting ${biz} with your irrigation system. We wanted to follow up and make sure everything is running well after our recent visit.\n\nIf you've noticed anything — dry spots, a zone not running, or higher water use — just let us know and we'll take a look.${sign}`,
      }),
      recall: () => ({
        subject: `Time to schedule your seasonal service`,
        body: `Hi ${first},\n\nIt's that time of year again! To keep your irrigation system in top shape, we recommend scheduling your seasonal service with ${biz}.\n\nReply to this email or give us a call and we'll find a time that works for you.${sign}`,
      }),
    };
    return (T[type] || T.followup)();
  }

  Router.register('emails', {
    title: 'Email Center',
    async render(view, params) {
      if (params.compose) return compose(view, params.compose, params.ref);
      return list(view);
    },
  });

  async function list(view) {
    const emails = (await DB.all('emails')).sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));

    view.appendChild(el('div', { style: 'display:flex;align-items:center;gap:8px;margin-bottom:14px' }, [
      el('h1', { style: 'font-size:21px;font-weight:800;letter-spacing:-.4px;flex:1', text: 'Email Center' }),
    ]));

    // quick compose
    view.appendChild(el('div.section-title', ['New email']));
    const quick = el('div', { style: 'display:grid;grid-template-columns:repeat(2,1fr);gap:10px;margin-bottom:18px' });
    Object.entries(TEMPLATES).forEach(([key, t]) => quick.appendChild(
      el('button.btn.btn-subtle', { style: 'justify-content:flex-start;height:auto;padding:13px', onClick: () => Router.go('emails', { compose: key }) },
        [UI.icon(t.icon), t.label])));
    view.appendChild(quick);

    view.appendChild(el('div.section-title', ['History']));
    if (!emails.length) { view.appendChild(UI.empty({ icon: 'email', title: 'No emails yet',
      text: 'Drafts and sent emails will appear here. Pick a template above to get started.' })); return; }
    const card = el('div.card'); const lst = el('div.list');
    emails.forEach(e => lst.appendChild(el('div.row', { onClick: () => compose(null, e.type, e.relatedId, e) }, [
      el('div.qi.tint-sky', { style: 'width:36px;height:36px;flex:none' }, [UI.icon((TEMPLATES[e.type] || {}).icon || 'email')]),
      el('div.grow', [el('div.t1', { text: e.subject || '(no subject)' }),
        el('div.t2', { text: `${e.to || 'No recipient'} · ${UI.fmtDate(e.createdAt)}` })]),
      UI.pill({ draft: { label: 'Draft', cls: 'slate' }, sent: { label: 'Sent', cls: 'green' } }, e.status || 'draft'),
    ])));
    card.appendChild(lst); view.appendChild(card);
  }

  async function compose(view, type, refId, existingEmail) {
    if (!view) { Router.go('emails', { compose: type, ref: refId }); return; }
    const settings = await DB.settings();
    const tplDef = TEMPLATES[type] || TEMPLATES.followup;

    // resolve context doc + customer
    let doc = null, customer = null;
    if (refId && tplDef.needs === 'invoice') doc = await DB.get('invoices', refId);
    if (refId && tplDef.needs === 'estimate') doc = await DB.get('estimates', refId);
    if (doc) customer = await App.customer(doc.customerId);

    const data = existingEmail ? { ...existingEmail }
      : { type, relatedId: refId || null, status: 'draft', to: '', subject: '', body: '' };

    // customer picker (when no doc context)
    let custWrap = null;
    if (!doc) {
      const cs = App.customerSelect(customer ? customer.id : '', async id => {
        customer = id ? await App.customer(id) : null;
        if (customer) { toInput.value = customer.email || ''; data.to = toInput.value; await applyTemplate(); }
      });
      custWrap = el('div.field', [el('label', 'Customer'), cs.node]);
    }

    if (!existingEmail) {
      const gen = await generate(type, { settings, customer, doc });
      data.subject = gen.subject; data.body = gen.body;
      data.to = customer ? (customer.email || '') : '';
    }

    const toInput = el('input.input', { type: 'email', value: data.to, placeholder: 'recipient@email.com' });
    toInput.addEventListener('input', () => data.to = toInput.value);
    const subjInput = el('input.input', { value: data.subject });
    subjInput.addEventListener('input', () => data.subject = subjInput.value);
    const bodyInput = el('textarea.textarea', { value: data.body, style: 'min-height:260px;line-height:1.55' });
    bodyInput.addEventListener('input', () => data.body = bodyInput.value);

    async function applyTemplate() {
      const gen = await generate(type, { settings, customer, doc });
      data.subject = gen.subject; data.body = gen.body;
      subjInput.value = gen.subject; bodyInput.value = gen.body;
    }

    view.appendChild(el('div', { style: 'display:flex;align-items:center;gap:8px;margin-bottom:14px' }, [
      el('button.btn.btn-subtle.btn-sm', { onClick: () => Router.go('emails') }, '← Email Center'),
      el('h1', { style: 'font-size:19px;font-weight:800;flex:1', text: tplDef.label }),
    ]));

    if (doc) view.appendChild(el('div.banner.info', { style: 'margin-bottom:14px' }, [UI.icon(tplDef.icon),
      el('span', { text: `${doc.number} · ${customer ? customer.name : 'customer'} · ${money(doc.total)}` })]));

    const card = el('div.card.card-pad', { style: 'margin-bottom:14px' }, [
      custWrap,
      el('div.field', [el('label', 'To'), toInput]),
      el('div.field', [el('label', 'Subject'), subjInput]),
      el('div.field', [el('label', 'Message'), bodyInput]),
    ].filter(Boolean));
    view.appendChild(card);

    if (doc) view.appendChild(el('p', { class: 'muted', style: 'font-size:12.5px;margin:-4px 2px 14px',
      text: `Tip: download the ${tplDef.needs} PDF from its page and attach it in your mail app.` }));

    view.appendChild(el('div', { style: 'display:grid;gap:10px;margin-bottom:24px' }, [
      el('div', { style: 'display:grid;grid-template-columns:1fr 1fr;gap:10px' }, [
        el('button.btn.btn-ghost', { onClick: () => {
          navigator.clipboard?.writeText(`Subject: ${data.subject}\n\n${data.body}`).then(() => UI.toast('Copied to clipboard'),
            () => UI.toast('Copy failed', 'err')); } }, [UI.icon('inbox'), 'Copy text']),
        el('a.btn.btn-ghost', { href: mailto(data), onClick: () => save('sent') }, [UI.icon('email'), 'Open in mail app']),
      ]),
      el('button.btn.btn-primary', { onClick: () => save('draft', true) }, [UI.icon('check'), 'Save to history']),
    ]));

    function mailto(d) {
      return `mailto:${encodeURIComponent(d.to || '')}?subject=${encodeURIComponent(d.subject || '')}&body=${encodeURIComponent(d.body || '')}`;
    }
    async function save(status, toast) {
      data.status = status;
      await DB.put('emails', data);
      if (toast) { UI.toast('Saved to history'); Router.go('emails'); }
    }
  }
})();
