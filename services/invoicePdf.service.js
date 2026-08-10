const PDFDocument = require('pdfkit');
const path = require('path');

/* ───────────────────────────── font paths ────────────────────────────────── */
const FONT_DIR = path.join(__dirname, '..', 'assets', 'fonts');
const FONTS = {
  regular: path.join(FONT_DIR, 'Inter-Regular.ttf'),
  bold:    path.join(FONT_DIR, 'Inter-Bold.ttf'),
};

/* ───────────────────────────── colour palette ───────────────────────────── */
const C = {
  brand:     '#4f46e5',
  brandDark: '#3730a3',
  brandLt:   '#eef2ff',
  dark:      '#0f172a',
  text:      '#1e293b',
  muted:     '#64748b',
  faint:     '#94a3b8',
  line:      '#e2e8f0',
  bg:        '#f8fafc',
  green:     '#16a34a',
  greenBg:   '#f0fdf4',
  greenBdr:  '#bbf7d0',
  white:     '#ffffff',
};

/* ─────────────────────── helper: draw rounded rect ──────────────────────── */
function roundedRect(doc, x, y, w, h, r) {
  doc.moveTo(x + r, y)
    .lineTo(x + w - r, y)
    .quadraticCurveTo(x + w, y, x + w, y + r)
    .lineTo(x + w, y + h - r)
    .quadraticCurveTo(x + w, y + h, x + w - r, y + h)
    .lineTo(x + r, y + h)
    .quadraticCurveTo(x, y + h, x, y + h - r)
    .lineTo(x, y + r)
    .quadraticCurveTo(x, y, x + r, y);
}

/* ─────────────────── helper: draw small green checkmark ─────────────────── */
function drawCheckmark(doc, cx, cy, size) {
  doc.save();
  doc.strokeColor(C.green).lineWidth(2).lineCap('round').lineJoin('round');
  doc.moveTo(cx - size * 0.4, cy)
    .lineTo(cx - size * 0.05, cy + size * 0.35)
    .lineTo(cx + size * 0.45, cy - size * 0.3)
    .stroke();
  doc.restore();
}

/* ─────────────────────── helper: currency format ────────────────────────── */
function formatINR(v) {
  if (v == null || isNaN(v)) return 'Rs. 0.00';
  return 'Rs. ' + Number(v).toFixed(2);
}

/* ─────────────── helper: separator dot (safe ASCII) ─────────────────────── */
const DOT = '  |  ';
const TIMES = ' x ';

/* ───────────────────────────── main generator ───────────────────────────── */
function generateInvoicePdfBuffer(order, user) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50, size: 'A4', bufferPages: true });
      const buffers = [];

      doc.on('data', (chunk) => buffers.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', (err) => reject(err));

      // Register Inter fonts for proper Unicode & better typography
      doc.registerFont('Inter', FONTS.regular);
      doc.registerFont('Inter-Bold', FONTS.bold);

      const PW = 595.28;          // A4 width in points
      const M = 50;               // margin
      const CW = PW - M * 2;      // content width
      const invoiceDate = new Date(order.createdAt || Date.now());
      const dateStr = invoiceDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

      /* ================================================================== */
      /*  HEADER BAR                                                        */
      /* ================================================================== */
      doc.rect(0, 0, PW, 105).fill(C.brand);

      // Left — Brand
      doc.fillColor(C.white).font('Inter-Bold').fontSize(30)
        .text('INKS', M, 26);

      doc.font('Inter').fontSize(9).fillColor('#c7d2fe')
        .text('BY TRACKIFY  |  CLOUD PRINT HUB', M, 62);

      // Right — Invoice label
      doc.font('Inter-Bold').fontSize(20).fillColor(C.white)
        .text('TAX INVOICE', M, 28, { align: 'right', width: CW });

      doc.font('Inter').fontSize(9).fillColor('#c7d2fe')
        .text(dateStr, M, 56, { align: 'right', width: CW });

      doc.font('Inter').fontSize(8).fillColor('#c7d2fe')
        .text('#' + order.orderNumber, M, 70, { align: 'right', width: CW });

      /* ================================================================== */
      /*  BILLED-TO / ORDER-INFO  (two column cards)                        */
      /* ================================================================== */
      const infoY = 126;
      const colW = (CW - 24) / 2;

      // Left card — Billed To
      doc.save();
      roundedRect(doc, M, infoY, colW, 88, 8);
      doc.fill(C.bg);
      doc.restore();

      doc.fillColor(C.faint).font('Inter-Bold').fontSize(8)
        .text('BILLED TO', M + 18, infoY + 14);

      doc.moveTo(M + 18, infoY + 28).lineTo(M + colW - 18, infoY + 28)
        .strokeColor(C.line).lineWidth(0.5).stroke();

      doc.fillColor(C.dark).font('Inter-Bold').fontSize(12)
        .text(user?.name || order.user?.name || 'Customer', M + 18, infoY + 36);

      doc.fillColor(C.muted).font('Inter').fontSize(9)
        .text(user?.email || order.user?.email || '--', M + 18, infoY + 56);

      // Right card — Order Info
      const rX = M + colW + 24;
      doc.save();
      roundedRect(doc, rX, infoY, colW, 88, 8);
      doc.fill(C.bg);
      doc.restore();

      doc.fillColor(C.faint).font('Inter-Bold').fontSize(8)
        .text('ORDER DETAILS', rX + 18, infoY + 14);

      doc.moveTo(rX + 18, infoY + 28).lineTo(rX + colW - 18, infoY + 28)
        .strokeColor(C.line).lineWidth(0.5).stroke();

      const lx = rX + 18;
      const rx = rX + colW - 18;

      // Order ID row
      doc.fillColor(C.muted).font('Inter').fontSize(9)
        .text('Order No.', lx, infoY + 36);
      doc.fillColor(C.brand).font('Inter-Bold').fontSize(9)
        .text(order.orderNumber, rx - 130, infoY + 36, { width: 130, align: 'right' });

      // Payment Status row
      doc.fillColor(C.muted).font('Inter').fontSize(9)
        .text('Payment', lx, infoY + 52);
      doc.fillColor(C.green).font('Inter-Bold').fontSize(9)
        .text('PAID', rx - 130, infoY + 52, { width: 130, align: 'right' });
      // Draw a small checkmark next to PAID
      drawCheckmark(doc, rx + 3, infoY + 56, 7);

      // Method row
      doc.fillColor(C.muted).font('Inter').fontSize(9)
        .text('Method', lx, infoY + 68);
      doc.fillColor(C.text).font('Inter').fontSize(9)
        .text(order.paymentMethod || 'Online', rx - 130, infoY + 68, { width: 130, align: 'right' });

      /* ================================================================== */
      /*  ITEMS TABLE                                                       */
      /* ================================================================== */
      const tableY = infoY + 112;
      const cDesc = M + 14;
      const cConf = M + 230;
      const cQty  = M + 380;
      const cAmt  = M + CW - 14;

      // Table header bar
      doc.save();
      roundedRect(doc, M, tableY, CW, 30, 6);
      doc.fill(C.brandLt);
      doc.restore();

      doc.fillColor(C.brand).font('Inter-Bold').fontSize(8);
      doc.text('DESCRIPTION', cDesc, tableY + 10);
      doc.text('CONFIGURATION', cConf, tableY + 10);
      doc.text('QTY', cQty, tableY + 10);
      doc.text('AMOUNT', cAmt - 70, tableY + 10, { width: 70, align: 'right' });

      // Table body row
      const rowY = tableY + 42;
      const docName = order.document?.originalName || 'Print Document';
      const colorText = order.colorMode === 'COLOR' ? 'Full Color' : 'Black & White';
      const sideText = order.sides === 'DOUBLE' ? 'Duplex (Double-sided)' : 'Single-sided';
      const bindingText = order.binding && order.binding !== 'none'
        ? order.binding.charAt(0).toUpperCase() + order.binding.slice(1)
        : 'None';

      // Document name
      const displayName = docName.length > 34 ? docName.substring(0, 31) + '...' : docName;
      doc.fillColor(C.dark).font('Inter-Bold').fontSize(10)
        .text(displayName, cDesc, rowY);

      // Paper + color specs
      doc.fillColor(C.muted).font('Inter').fontSize(8)
        .text((order.paperSize || 'A4') + DOT + colorText, cDesc, rowY + 17);

      // Config column
      doc.fillColor(C.text).font('Inter').fontSize(9)
        .text(sideText, cConf, rowY + 2);
      doc.fillColor(C.muted).font('Inter').fontSize(8)
        .text('Binding: ' + bindingText, cConf, rowY + 17);

      // Qty column
      doc.fillColor(C.text).font('Inter').fontSize(9)
        .text((order.totalPages || 1) + ' pg' + TIMES + (order.copies || 1), cQty, rowY + 8);

      // Amount column
      doc.fillColor(C.dark).font('Inter-Bold').fontSize(10)
        .text(formatINR(order.subtotal), cAmt - 80, rowY + 8, { width: 80, align: 'right' });

      // Row bottom divider
      const divY = rowY + 44;
      doc.moveTo(M, divY).lineTo(M + CW, divY).strokeColor(C.line).lineWidth(0.75).stroke();

      /* ================================================================== */
      /*  TOTALS SECTION  (right-aligned summary)                           */
      /* ================================================================== */
      const totLabelX = M + CW - 240;
      const totValX = M + CW - 100;
      const totW = 100;
      let ty = divY + 20;

      function totalRow(label, value, opts = {}) {
        doc.fillColor(opts.color || C.muted).font('Inter').fontSize(9)
          .text(label, totLabelX, ty);
        doc.fillColor(opts.color || C.dark).font('Inter-Bold').fontSize(9)
          .text(value, totValX, ty, { width: totW, align: 'right' });
        ty += 22;
      }

      totalRow('Subtotal', formatINR(order.subtotal));

      if (order.discountAmount > 0) {
        totalRow('Coupon Discount', '- ' + formatINR(order.discountAmount), { color: C.green });
      }

      totalRow('GST / Tax (18%)', formatINR(order.tax));

      // Grand total bar
      ty += 6;
      doc.save();
      roundedRect(doc, totLabelX - 14, ty - 8, 254, 36, 8);
      doc.fill(C.brandLt);
      doc.restore();

      doc.fillColor(C.brand).font('Inter-Bold').fontSize(13)
        .text('Total Paid', totLabelX, ty + 2);
      doc.fillColor(C.brand).font('Inter-Bold').fontSize(14)
        .text(formatINR(order.totalAmount), totValX, ty + 1, { width: totW, align: 'right' });

      /* ================================================================== */
      /*  COLLECTION NOTICE (green card)                                    */
      /* ================================================================== */
      const noticeY = ty + 58;
      doc.save();
      roundedRect(doc, M, noticeY, CW, 68, 10);
      doc.fillAndStroke(C.greenBg, C.greenBdr);
      doc.restore();

      // Draw a green circle with check
      doc.save();
      doc.circle(M + 28, noticeY + 20, 8).fill(C.green);
      doc.strokeColor(C.white).lineWidth(1.5).lineCap('round').lineJoin('round');
      doc.moveTo(M + 24, noticeY + 20)
        .lineTo(M + 27, noticeY + 23)
        .lineTo(M + 33, noticeY + 17)
        .stroke();
      doc.restore();

      doc.fillColor('#166534').font('Inter-Bold').fontSize(11)
        .text('Thank you for choosing Inks by Trackify!', M + 44, noticeY + 15);

      doc.fillColor('#15803d').font('Inter').fontSize(9)
        .text(
          'Present this invoice or your Order ID at the Inks printing desk to collect your documents. ' +
          'For queries, contact us at support@mail.trackifyapp.co.in.',
          M + 20, noticeY + 38, { width: CW - 40, lineGap: 3 }
        );

      /* ================================================================== */
      /*  TERMS & CONDITIONS                                                */
      /* ================================================================== */
      const termsY = noticeY + 88;
      doc.fillColor(C.faint).font('Inter-Bold').fontSize(7)
        .text('TERMS & CONDITIONS', M, termsY);

      const terms = [
        'All orders are non-refundable once printing has commenced.',
        'Documents are retained for 48 hours after printing and then permanently deleted.',
        'Prices are inclusive of platform fees; GST charged at 18% where applicable.',
        'Colour accuracy may vary depending on printer calibration.',
      ];
      doc.fillColor(C.faint).font('Inter').fontSize(7);
      let termY = termsY + 14;
      terms.forEach((t) => {
        doc.text('- ' + t, M + 4, termY, { width: CW - 4 });
        termY += 11;
      });

      /* ================================================================== */
      /*  PAGE FOOTER                                                       */
      /* ================================================================== */
      doc.moveTo(M, 768).lineTo(M + CW, 768).strokeColor(C.line).lineWidth(0.5).stroke();

      doc.fillColor(C.faint).font('Inter').fontSize(7)
        .text('Inks by Trackify  |  Automated Cloud Printing  |  mail.trackifyapp.co.in', M, 775, {
          width: CW, align: 'center'
        });

      doc.fillColor(C.faint).font('Inter').fontSize(7)
        .text('This is a computer-generated invoice and does not require a signature.', M, 787, {
          width: CW, align: 'center'
        });

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

module.exports = {
  generateInvoicePdfBuffer,
};
