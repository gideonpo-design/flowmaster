/* ==========================================================================
   pdf.js — professional invoice / estimate PDF export (offline, via jsPDF)
   PDF.invoice(inv, customer, settings)
   PDF.estimate(est, customer, settings)
   Letter size, branded header, line-item table, totals, status, footer.
   ========================================================================== */
const PDF = (() => {
  const BRAND = [15, 98, 184], INK = [22, 29, 39], MUTE = [120, 130, 142], LINE = [225, 230, 236];
  const money = (n) => '$' + (Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const dt = (d) => d ? new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '';

  let _logo = null, _logoTried = false;
  async function logo() {
    if (_logoTried) return _logo;
    _logoTried = true;
    try {
      const res = await fetch('icons/icon-192.png');
      const blob = await res.blob();
      _logo = await new Promise(r => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(blob); });
    } catch { _logo = null; }
    return _logo;
  }

  function statusStamp(status) {
    const m = {
      paid:     ['PAID', [31, 157, 87]],
      overdue:  ['OVERDUE', [210, 59, 59]],
      pending:  ['PENDING', [201, 129, 10]],
      unpaid:   ['BALANCE DUE', [91, 107, 124]],
      accepted: ['ACCEPTED', [31, 157, 87]],
      declined: ['DECLINED', [210, 59, 59]],
      sent:     ['SENT', [31, 114, 207]],
      draft:    ['DRAFT', [120, 130, 142]],
      converted:['CONVERTED', [107, 70, 193]],
    };
    return m[status] || ['', INK];
  }

  async function build(kind, doc_, obj, customer, settings) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: 'pt', format: 'letter' });
    const W = doc.internal.pageSize.getWidth();   // 612
    const M = 48;
    const isInvoice = kind === 'invoice';

    // ---- header band ----
    doc.setFillColor(...BRAND);
    doc.rect(0, 0, W, 96, 'F');
    const img = await logo();
    let textX = M;
    if (img) { try { doc.addImage(img, 'PNG', M, 26, 44, 44); textX = M + 58; } catch {} }
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(19);
    doc.text(settings.businessName || 'FlowMaster Irrigation Services', textX, 44);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5);
    doc.setTextColor(220, 232, 248);
    if (settings.slogan) doc.text(settings.slogan, textX, 60);
    const contact = [
      [settings.address, [settings.city, settings.state].filter(Boolean).join(', ') + (settings.zip ? ' ' + settings.zip : '')].filter(Boolean).join(' · '),
      [settings.phone, settings.email].filter(Boolean).join('  ·  '),
      settings.website || '',
    ].filter(Boolean);
    doc.setFontSize(8.5);
    contact.forEach((l, i) => doc.text(l, textX, 74 + i * 11));

    // ---- document title block (right) ----
    doc.setTextColor(...INK);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(26);
    doc.text(isInvoice ? 'INVOICE' : 'ESTIMATE', W - M, 140, { align: 'right' });
    doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(...MUTE);
    const meta = [
      [isInvoice ? 'Invoice #' : 'Estimate #', obj.number || '—'],
      ['Date', dt(obj.issueDate)],
      [isInvoice ? 'Due' : 'Valid until', dt(obj.dueDate || obj.expiryDate)],
    ];
    let my = 158;
    meta.forEach(([k, v]) => {
      if (!v || v === '—' && k.includes('Due')) return;
      doc.setTextColor(...MUTE); doc.text(k, W - M - 120, my, { align: 'left' });
      doc.setTextColor(...INK); doc.setFont('helvetica', 'bold');
      doc.text(String(v), W - M, my, { align: 'right' });
      doc.setFont('helvetica', 'normal'); my += 15;
    });

    // ---- bill to ----
    doc.setFontSize(8.5); doc.setTextColor(...MUTE);
    doc.text('BILL TO', M, 150);
    doc.setFontSize(12); doc.setTextColor(...INK); doc.setFont('helvetica', 'bold');
    doc.text(customer ? customer.name : 'Customer', M, 166);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5); doc.setTextColor(...MUTE);
    let by = 180;
    const cAddr = customer && (customer.billingAddress || customer.serviceAddress);
    [cAddr, customer && customer.phone, customer && customer.email].filter(Boolean)
      .forEach(l => { doc.text(String(l), M, by); by += 13; });
    if (obj.serviceAddress && obj.serviceAddress !== cAddr) { doc.text('Service: ' + obj.serviceAddress, M, by); by += 13; }
    if (obj.technician) { doc.text('Technician: ' + obj.technician, M, by); by += 13; }

    const tableTop = Math.max(by + 14, 224);

    // ---- line items table ----
    const rows = (obj.lineItems || []).map(li => [
      li.name + (li.description ? '\n' + li.description : ''),
      String(li.qty), money(li.price), money((li.qty || 0) * (li.price || 0)),
    ]);
    doc.autoTable({
      startY: tableTop,
      head: [['Description', 'Qty', 'Unit Price', 'Amount']],
      body: rows,
      margin: { left: M, right: M },
      styles: { font: 'helvetica', fontSize: 9.5, cellPadding: 7, textColor: INK, lineColor: LINE, lineWidth: 0.5 },
      headStyles: { fillColor: [243, 246, 250], textColor: [60, 72, 84], fontStyle: 'bold', lineColor: LINE },
      columnStyles: { 0: { cellWidth: 'auto' }, 1: { cellWidth: 50, halign: 'center' },
                      2: { cellWidth: 80, halign: 'right' }, 3: { cellWidth: 80, halign: 'right' } },
      alternateRowStyles: { fillColor: [250, 251, 253] },
    });

    // ---- totals ----
    let y = doc.lastAutoTable.finalY + 16;
    const tx = W - M - 220, vx = W - M;
    const totalRow = (label, val, bold) => {
      doc.setFont('helvetica', bold ? 'bold' : 'normal');
      doc.setFontSize(bold ? 12 : 10);
      doc.setTextColor(...(bold ? INK : MUTE));
      doc.text(label, tx, y); doc.setTextColor(...INK);
      doc.text(money(val), vx, y, { align: 'right' }); y += bold ? 20 : 16;
    };
    totalRow('Subtotal', obj.subtotal);
    totalRow(`Tax (${obj.taxRate || 0}%)`, obj.taxAmount);
    doc.setDrawColor(...LINE); doc.line(tx, y - 6, vx, y - 6);
    totalRow('Total', obj.total, true);
    if (isInvoice && obj.amountPaid > 0) {
      totalRow('Paid', -obj.amountPaid);
      totalRow('Balance Due', (obj.total || 0) - (obj.amountPaid || 0), true);
    }

    // ---- status stamp ----
    const eff = isInvoice && window.invoiceEffectiveStatus ? window.invoiceEffectiveStatus(obj) : obj.status;
    const [stampText, stampColor] = statusStamp(eff);
    if (stampText) {
      doc.setDrawColor(...stampColor); doc.setTextColor(...stampColor);
      doc.setLineWidth(1.5); doc.setFont('helvetica', 'bold'); doc.setFontSize(15);
      const sw = doc.getTextWidth(stampText) + 22;
      doc.roundedRect(M, doc.lastAutoTable.finalY + 22, sw, 26, 4, 4);
      doc.text(stampText, M + 11, doc.lastAutoTable.finalY + 39);
      doc.setLineWidth(0.5);
    }

    // ---- notes / terms / footer ----
    y = Math.max(y, doc.lastAutoTable.finalY + 70);
    doc.setTextColor(...MUTE); doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
    if (obj.notes) { doc.setFont('helvetica', 'bold'); doc.text('Notes', M, y); doc.setFont('helvetica', 'normal');
      y += 13; doc.text(doc.splitTextToSize(obj.notes, W - 2 * M), M, y); y += 13 * (doc.splitTextToSize(obj.notes, W - 2 * M).length) + 6; }
    const terms = obj.terms || settings.invoiceTerms;
    if (terms) { doc.setFont('helvetica', 'bold'); doc.text(isInvoice ? 'Terms' : 'Notes', M, y); doc.setFont('helvetica', 'normal');
      y += 13; doc.text(doc.splitTextToSize(terms, W - 2 * M), M, y); }

    // footer thank-you
    const ph = doc.internal.pageSize.getHeight();
    doc.setDrawColor(...LINE); doc.line(M, ph - 54, W - M, ph - 54);
    doc.setTextColor(...BRAND); doc.setFont('helvetica', 'bold'); doc.setFontSize(11);
    doc.text(settings.thankYou || 'Thank you for your business!', W / 2, ph - 36, { align: 'center' });
    doc.setTextColor(...MUTE); doc.setFont('helvetica', 'normal'); doc.setFontSize(8);
    doc.text((settings.businessName || 'FlowMaster') + (settings.phone ? '  ·  ' + settings.phone : ''), W / 2, ph - 22, { align: 'center' });

    return doc;
  }

  async function invoice(inv, customer, settings) {
    settings = settings || await DB.settings();
    customer = customer || (inv.customerId ? await App.customer(inv.customerId) : null);
    const doc = await build('invoice', null, inv, customer, settings);
    doc.save(`${inv.number || 'invoice'}.pdf`);
  }
  async function estimate(est, customer, settings) {
    settings = settings || await DB.settings();
    customer = customer || (est.customerId ? await App.customer(est.customerId) : null);
    const doc = await build('estimate', null, est, customer, settings);
    doc.save(`${est.number || 'estimate'}.pdf`);
  }
  // returns a data URI (for email attach previews)
  async function dataUri(kind, obj, customer, settings) {
    const doc = await build(kind, null, obj, customer, settings);
    return doc.output('datauristring');
  }

  return { invoice, estimate, dataUri };
})();
