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

function generateInvoicePdfBuffer(orderInput, user) {
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

      // Extract items array (multi-file batch or single file)
      let items = [];
      let mainOrderNumber = orderInput.batchNumber || orderInput.orderNumber || 'INV-001';
      let totalAmount = orderInput.totalAmount || 0;
      let subtotal = orderInput.subtotal || totalAmount;
      let discountAmount = orderInput.discountAmount || 0;
      let paymentMethod = orderInput.paymentMethod || 'Ink Wallet';
      let createdAt = orderInput.createdAt || Date.now();

      if (orderInput.orders && Array.isArray(orderInput.orders) && orderInput.orders.length > 0) {
        items = orderInput.orders;
      } else if (orderInput.batchOrder && orderInput.batchOrder.orders && orderInput.batchOrder.orders.length > 0) {
        items = orderInput.batchOrder.orders;
        mainOrderNumber = orderInput.batchOrder.batchNumber || mainOrderNumber;
        totalAmount = orderInput.batchOrder.totalAmount || totalAmount;
      } else {
        items = [orderInput];
      }

      const invoiceDate = new Date(createdAt);
      const dateStr = invoiceDate.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });

      let y = M;

      /* ================================================================== */
      /*  1. HEADER SECTION                                                 */
      /* ================================================================== */
      const logoPath = path.join(__dirname, '..', 'assets', 'inks_logo.png');
      const headerTopY = y;
      if (fs.existsSync(logoPath)) {
        try {
          doc.image(logoPath, M, y, { width: 145 });
          y += 68;
          doc.fillColor(C.muted).font(fontReg).fontSize(8).text('Cloud Printing & Document Services', M, y);
          doc.fillColor(C.muted).font(fontReg).fontSize(7.5).text('Email: support@mail.trackifyapp.co.in | Web: inks.trackifyapp.co.in', M, y + 11);
          y += 26;
        } catch (imgErr) {
          console.warn('PDFKit logo render fallback:', imgErr.message);
          doc.fillColor(C.black).font(fontBold).fontSize(20).text('INKS BY TRACKIFY', M, y);
          doc.fillColor(C.muted).font(fontReg).fontSize(8.5).text('Cloud Printing & Document Services', M, y + 24);
          doc.fillColor(C.muted).font(fontReg).fontSize(8).text('Email: support@mail.trackifyapp.co.in | Web: inks.trackifyapp.co.in', M, y + 36);
          y += 56;
        }
      } else {
        doc.fillColor(C.black).font(fontBold).fontSize(20).text('INKS BY TRACKIFY', M, y);
        doc.fillColor(C.muted).font(fontReg).fontSize(8.5).text('Cloud Printing & Document Services', M, y + 24);
        doc.fillColor(C.muted).font(fontReg).fontSize(8).text('Email: support@mail.trackifyapp.co.in | Web: inks.trackifyapp.co.in', M, y + 36);
        y += 56;
      }

      doc.fillColor(C.black).font(fontBold).fontSize(16).text('PRINT ORDER INVOICE', M, headerTopY, { align: 'right', width: CW });
      doc.fillColor(C.dark).font(fontBold).fontSize(9.5).text(`#${mainOrderNumber}`, M, headerTopY + 22, { align: 'right', width: CW });
      doc.fillColor(C.muted).font(fontReg).fontSize(8.5).text(`Date: ${dateStr}`, M, headerTopY + 36, { align: 'right', width: CW });

      doc.moveTo(M, y).lineTo(M + CW, y).strokeColor(C.black).lineWidth(1.25).stroke();
      y += 16;

      /* ================================================================== */
      /*  2. BILLED TO & ORDER DETAILS                                      */
      /* ================================================================== */
      const colW = (CW - 30) / 2;
      const col2X = M + colW + 30;

      const customerName = user?.name || orderInput.user?.name || orderInput.batchOrder?.user?.name || 'Customer';
      const customerEmail = user?.email || orderInput.user?.email || orderInput.batchOrder?.user?.email || 'N/A';

      doc.fillColor(C.muted).font(fontBold).fontSize(7.5).text('BILLED TO', M, y);
      doc.fillColor(C.black).font(fontBold).fontSize(10.5).text(customerName, M, y + 12);
      doc.fillColor(C.text).font(fontReg).fontSize(8.5).text(customerEmail, M, y + 26);

      doc.fillColor(C.muted).font(fontBold).fontSize(7.5).text('PAYMENT & STATUS', col2X, y);
      doc.fillColor(C.text).font(fontReg).fontSize(8.5).text('Payment Status:', col2X, y + 12);
      doc.fillColor(C.success).font(fontBold).fontSize(8.5).text('PAID', col2X + 85, y + 12);

      doc.fillColor(C.text).font(fontReg).fontSize(8.5).text('Payment Method:', col2X, y + 26);
      const payMethodStr = paymentMethod === 'WALLET' ? 'Ink Wallet' : (paymentMethod || 'Ink Wallet');
      doc.fillColor(C.black).font(fontBold).fontSize(8.5).text(payMethodStr, col2X + 85, y + 26);

      y += 50;

      /* ================================================================== */
      /*  3. LINE ITEMS TABLE (Lists ALL Files & Specs in Batch)            */
      /* ================================================================== */
      const tableHeadH = 22;
      const c1 = M + 10;           // Item & Details
      const c2 = M + 220;          // Specs
      const c3 = M + 350;          // Qty / Pages
      const c4 = M + CW - 10;      // Amount

      doc.rect(M, y, CW, tableHeadH).fill(C.tableBg);
      doc.rect(M, y, CW, tableHeadH).strokeColor(C.borderDark).lineWidth(0.75).stroke();

      doc.fillColor(C.dark).font(fontBold).fontSize(8);
      doc.text('DESCRIPTION / FILENAME', c1, y + 6);
      doc.text('PRINT SPECIFICATIONS', c2, y + 6);
      doc.text('PAGES / COPIES', c3, y + 6);
      doc.text('AMOUNT', c4 - 80, y + 6, { width: 80, align: 'right' });

      y += tableHeadH;

      let calcSubtotal = 0;

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const rowH = 44;

        if (y + rowH > 720) {
          doc.addPage({ margin: 50, size: 'A4' });
          y = M;
        }

        doc.rect(M, y, CW, rowH).strokeColor(C.border).lineWidth(0.5).stroke();

        const docName = item.document?.originalName || item.originalName || `Print File #${i + 1}`;
        const displayName = docName.length > 34 ? docName.substring(0, 31) + '...' : docName;
        const colorText = item.colorMode === 'COLOR' ? 'Full Colour' : 'Black & White';
        const sideText = item.sides === 'DOUBLE' ? 'Double-sided' : 'Single-sided';
        const bindingText = item.binding && item.binding !== 'none'
          ? item.binding.charAt(0).toUpperCase() + item.binding.slice(1)
          : 'None';

        const itemCost = item.subtotal || item.totalAmount || 0;
        calcSubtotal += itemCost;

        // Item Column
        doc.fillColor(C.black).font(fontBold).fontSize(8.5).text(`${i + 1}. ${displayName}`, c1, y + 9);
        doc.fillColor(C.muted).font(fontReg).fontSize(7.5).text(`Page Range: ${item.pageRange || 'All'}`, c1, y + 24);

        // Specs Column
        doc.fillColor(C.text).font(fontReg).fontSize(8).text(`${item.paperSize || 'A4'} · ${colorText}`, c2, y + 9);
        doc.fillColor(C.muted).font(fontReg).fontSize(7.5).text(`${sideText} · Binding: ${bindingText}`, c2, y + 24);

        // Qty Column
        doc.fillColor(C.text).font(fontReg).fontSize(8).text(`${item.totalPages || 1} pg × ${item.copies || 1} ${item.copies === 1 ? 'copy' : 'copies'}`, c3, y + 16);

        // Amount Column
        doc.fillColor(C.black).font(fontBold).fontSize(8.5).text(formatINR(itemCost), c4 - 80, y + 16, { width: 80, align: 'right' });

        y += rowH;
      }

      y += 14;

      /* ================================================================== */
      /*  4. FINANCIAL SUMMARY                                              */
      /* ================================================================== */
      const sumW = 220;
      const sumX = M + CW - sumW;
      const sumLabelX = sumX + 10;
      const sumValX = sumX + sumW - 10;

      const finalSubtotal = calcSubtotal > 0 ? calcSubtotal : subtotal;
      const finalTaxable = Math.max(0, finalSubtotal - discountAmount);
      const taxRate = orderInput.taxRate || 0.18;
      const finalTax = orderInput.tax || Math.round(finalTaxable * taxRate * 100) / 100;
      const finalGrandTotal = totalAmount > 0 ? totalAmount : Math.round((finalTaxable + finalTax) * 100) / 100;

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

      drawSummaryRow('Subtotal:', formatINR(finalSubtotal));

      if (discountAmount > 0) {
        drawSummaryRow('Coupon Discount:', `- ${formatINR(discountAmount)}`, false, true);
      }

      drawSummaryRow(`Service Charge (${Math.round(taxRate * 100)}%):`, formatINR(finalTax));

      doc.moveTo(sumX, y - 3).lineTo(M + CW, y - 3).strokeColor(C.borderDark).lineWidth(0.75).stroke();

      y += 3;
      doc.rect(sumX, y - 5, sumW, 24).fill(C.tableBg);
      doc.rect(sumX, y - 5, sumW, 24).strokeColor(C.black).lineWidth(1).stroke();

      doc.fillColor(C.black).font(fontBold).fontSize(9.5).text('Total Amount Paid:', sumLabelX, y + 2);
      doc.fillColor(C.black).font(fontBold).fontSize(10).text(formatINR(finalGrandTotal), sumValX - 100, y + 1, { width: 100, align: 'right' });

      y += 40;

      /* ================================================================== */
      /*  5. COLLECTION INFORMATION                                         */
      /* ================================================================== */
      doc.rect(M, y, CW, 42).strokeColor(C.border).lineWidth(0.5).stroke();
      doc.fillColor(C.dark).font(fontBold).fontSize(8).text('COLLECTION INFORMATION', M + 10, y + 7);
      doc.fillColor(C.muted).font(fontReg).fontSize(7.5).text(
        `Present Order #${mainOrderNumber} at the Inks document counter to collect your prints. Printed files are retained for 48 hours.`,
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
        `2. Prices include service charge @ ${Math.round(taxRate * 100)}% and document processing fees.`,
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
