const PDFDocument = require('pdfkit');
const path = require('path');
const fs = require('fs');

/* ───────────────────────────── font paths ────────────────────────────────── */
const FONT_DIR = path.join(__dirname, '..', 'assets', 'fonts');
const FONTS = {
  regular: path.join(FONT_DIR, 'Inter-Regular.ttf'),
  bold:    path.join(FONT_DIR, 'Inter-Bold.ttf'),
};

/* ───────────────────────────── Corporate Color Palette ───────────────────────────── */
const C = {
  black:      '#111827',
  dark:       '#1f2937',
  text:       '#374151',
  muted:      '#6b7280',
  lightMuted: '#9ca3af',
  border:     '#e5e7eb',
  borderDark: '#d1d5db',
  tableBg:    '#f9fafb',
  white:      '#ffffff',
  success:    '#15803d',
};

function formatINR(v) {
  if (v == null || isNaN(v)) return 'Rs. 0.00';
  return 'Rs. ' + Number(v).toFixed(2);
}

function generateInvoicePdfBuffer(order, user) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50, size: 'A4', bufferPages: true });
      const buffers = [];

      doc.on('data', (chunk) => buffers.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', (err) => reject(err));

      const hasInterReg = fs.existsSync(FONTS.regular);
      const hasInterBold = fs.existsSync(FONTS.bold);

      if (hasInterReg && hasInterBold) {
        doc.registerFont('Inter', FONTS.regular);
        doc.registerFont('Inter-Bold', FONTS.bold);
      }

      const fontReg = hasInterReg ? 'Inter' : 'Helvetica';
      const fontBold = hasInterBold ? 'Inter-Bold' : 'Helvetica-Bold';

      const PW = 595.28;     // A4 width in pt
      const M = 50;          // Margin
      const CW = PW - M * 2; // Content width: 495.28 pt

      const invoiceDate = new Date(order.createdAt || Date.now());
      const dateStr = invoiceDate.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });

      let y = M;

      /* ================================================================== */
      /*  1. HEADER SECTION (Clean Professional Corporate Layout)           */
      /* ================================================================== */
      // Company Info (Left)
      doc.fillColor(C.black).font(fontBold).fontSize(20).text('INKS BY TRACKIFY', M, y);
      doc.fillColor(C.muted).font(fontReg).fontSize(8.5).text('Cloud Printing & Document Services', M, y + 24);
      doc.fillColor(C.muted).font(fontReg).fontSize(8).text('Email: support@mail.trackifyapp.co.in | Web: inks.trackifyapp.co.in', M, y + 36);

      // Invoice Title & Ref (Right)
      doc.fillColor(C.black).font(fontBold).fontSize(16).text('TAX INVOICE', M, y, { align: 'right', width: CW });
      doc.fillColor(C.dark).font(fontBold).fontSize(9.5).text(`#${order.orderNumber}`, M, y + 22, { align: 'right', width: CW });
      doc.fillColor(C.muted).font(fontReg).fontSize(8.5).text(`Date: ${dateStr}`, M, y + 36, { align: 'right', width: CW });

      y += 56;

      // Top Divider Line
      doc.moveTo(M, y).lineTo(M + CW, y).strokeColor(C.black).lineWidth(1.25).stroke();
      y += 16;

      /* ================================================================== */
      /*  2. BILLED TO & ORDER DETAILS (Structured Two-Column Grid)         */
      /* ================================================================== */
      const colW = (CW - 30) / 2;
      const col2X = M + colW + 30;

      // Customer Details (Left Column)
      doc.fillColor(C.muted).font(fontBold).fontSize(7.5).text('BILLED TO', M, y);
      doc.fillColor(C.black).font(fontBold).fontSize(10.5).text(user?.name || order.user?.name || 'Customer', M, y + 12);
      doc.fillColor(C.text).font(fontReg).fontSize(8.5).text(user?.email || order.user?.email || 'N/A', M, y + 26);

      // Order Specs (Right Column)
      doc.fillColor(C.muted).font(fontBold).fontSize(7.5).text('PAYMENT & STATUS', col2X, y);
      
      doc.fillColor(C.text).font(fontReg).fontSize(8.5).text('Payment Status:', col2X, y + 12);
      doc.fillColor(C.success).font(fontBold).fontSize(8.5).text('PAID', col2X + 85, y + 12);

      doc.fillColor(C.text).font(fontReg).fontSize(8.5).text('Payment Method:', col2X, y + 26);
      const payMethod = order.paymentMethod === 'WALLET' ? 'Ink Wallet' : (order.paymentMethod || 'Online');
      doc.fillColor(C.black).font(fontBold).fontSize(8.5).text(payMethod, col2X + 85, y + 26);

      y += 50;

      /* ================================================================== */
      /*  3. LINE ITEMS TABLE (Clean Corporate Table with Borders)          */
      /* ================================================================== */
      const tableHeadH = 22;
      const c1 = M + 10;           // Item & Details
      const c2 = M + 220;          // Specs
      const c3 = M + 350;          // Qty / Pages
      const c4 = M + CW - 10;      // Amount

      // Table Header Row Box
      doc.rect(M, y, CW, tableHeadH).fill(C.tableBg);
      doc.rect(M, y, CW, tableHeadH).strokeColor(C.borderDark).lineWidth(0.75).stroke();

      doc.fillColor(C.dark).font(fontBold).fontSize(8);
      doc.text('DESCRIPTION', c1, y + 6);
      doc.text('PRINT SPECIFICATIONS', c2, y + 6);
      doc.text('PAGES / COPIES', c3, y + 6);
      doc.text('AMOUNT', c4 - 80, y + 6, { width: 80, align: 'right' });

      y += tableHeadH;

      // Table Content Row
      const rowH = 44;
      doc.rect(M, y, CW, rowH).strokeColor(C.border).lineWidth(0.5).stroke();

      const docName = order.document?.originalName || 'Print Document';
      const displayName = docName.length > 36 ? docName.substring(0, 33) + '...' : docName;
      const colorText = order.colorMode === 'COLOR' ? 'Full Colour' : 'Black & White';
      const sideText = order.sides === 'DOUBLE' ? 'Double-sided' : 'Single-sided';
      const bindingText = order.binding && order.binding !== 'none'
        ? order.binding.charAt(0).toUpperCase() + order.binding.slice(1)
        : 'None';

      // Item Column
      doc.fillColor(C.black).font(fontBold).fontSize(9).text(displayName, c1, y + 9);
      doc.fillColor(C.muted).font(fontReg).fontSize(7.5).text(`Page Range: ${order.pageRange || 'All'}`, c1, y + 24);

      // Specs Column
      doc.fillColor(C.text).font(fontReg).fontSize(8).text(`${order.paperSize || 'A4'} · ${colorText}`, c2, y + 9);
      doc.fillColor(C.muted).font(fontReg).fontSize(7.5).text(`${sideText} · Binding: ${bindingText}`, c2, y + 24);

      // Qty Column
      doc.fillColor(C.text).font(fontReg).fontSize(8).text(`${order.totalPages || 1} pg × ${order.copies || 1} ${order.copies === 1 ? 'copy' : 'copies'}`, c3, y + 16);

      // Amount Column
      doc.fillColor(C.black).font(fontBold).fontSize(9).text(formatINR(order.subtotal), c4 - 80, y + 16, { width: 80, align: 'right' });

      y += rowH + 14;

      /* ================================================================== */
      /*  4. FINANCIAL SUMMARY (Right-Aligned Corporate Ledger)             */
      /* ================================================================== */
      const sumW = 220;
      const sumX = M + CW - sumW;
      const sumLabelX = sumX + 10;
      const sumValX = sumX + sumW - 10;

      function drawSummaryRow(label, value, isBold = false, isGreen = false) {
        doc.fillColor(isGreen ? C.success : (isBold ? C.black : C.muted))
           .font(isBold ? fontBold : fontReg)
           .fontSize(8)
           .text(label, sumLabelX, y);

        doc.fillColor(isGreen ? C.success : (isBold ? C.black : C.dark))
           .font(isBold ? fontBold : fontReg)
           .fontSize(8)
           .text(value, sumValX - 100, y, { width: 100, align: 'right' });

        y += 16;
      }

      drawSummaryRow('Subtotal:', formatINR(order.subtotal));

      if (order.discountAmount > 0) {
        drawSummaryRow('Coupon Discount:', `- ${formatINR(order.discountAmount)}`, false, true);
      }

      drawSummaryRow('GST (18%):', formatINR(order.tax));

      // Divider line before Total
      doc.moveTo(sumX, y - 3).lineTo(M + CW, y - 3).strokeColor(C.borderDark).lineWidth(0.75).stroke();

      y += 3;
      // Total Row with Highlight Box
      doc.rect(sumX, y - 5, sumW, 24).fill(C.tableBg);
      doc.rect(sumX, y - 5, sumW, 24).strokeColor(C.black).lineWidth(1).stroke();

      doc.fillColor(C.black).font(fontBold).fontSize(9.5).text('Total Amount Paid:', sumLabelX, y + 2);
      doc.fillColor(C.black).font(fontBold).fontSize(10).text(formatINR(order.totalAmount), sumValX - 100, y + 1, { width: 100, align: 'right' });

      y += 40;

      /* ================================================================== */
      /*  5. COLLECTION & SUPPORT NOTES                                     */
      /* ================================================================== */
      doc.rect(M, y, CW, 42).strokeColor(C.border).lineWidth(0.5).stroke();
      doc.fillColor(C.dark).font(fontBold).fontSize(8).text('COLLECTION INFORMATION', M + 10, y + 7);
      doc.fillColor(C.muted).font(fontReg).fontSize(7.5).text(
        `Present Order #${order.orderNumber} at the Inks document counter to collect your prints. Printed files are retained for 48 hours.`,
        M + 10, y + 21, { width: CW - 20 }
      );

      y += 58;

      /* ================================================================== */
      /*  6. TERMS & CONDITIONS                                             */
      /* ================================================================== */
      doc.fillColor(C.muted).font(fontBold).fontSize(7.5).text('TERMS & CONDITIONS', M, y);
      y += 11;

      const terms = [
        '1. All orders are final once document printing has commenced.',
        '2. Prices are inclusive of all applicable taxes including GST @ 18%.',
        '3. Printed files are automatically cleaned up 48 hours after fulfillment for privacy compliance.',
      ];

      doc.fillColor(C.lightMuted).font(fontReg).fontSize(7);
      terms.forEach((t) => {
        doc.text(t, M, y);
        y += 10;
      });

      /* ================================================================== */
      /*  7. FOOTER                                                         */
      /* ================================================================== */
      const footerY = 770;
      doc.moveTo(M, footerY).lineTo(M + CW, footerY).strokeColor(C.border).lineWidth(0.5).stroke();

      doc.fillColor(C.lightMuted).font(fontReg).fontSize(7)
         .text('This is a computer-generated tax invoice and requires no physical signature.', M, footerY + 8, { align: 'center', width: CW });

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

module.exports = {
  generateInvoicePdfBuffer,
};
