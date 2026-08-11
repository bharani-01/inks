/**
 * Cover Page PDF & Document Merging Service
 * Inspired by security cover sheets (Blinkit style).
 *
 * Auto-prepends the Front Security Cover (Page 1) and
 * auto-appends the Back Security Cover (Last Page)
 * directly into the customer's printable document bundle.
 */

const PDFKitDocument = require('pdfkit');
const { PDFDocument: PDFLibDoc } = require('pdf-lib');
const QRCode = require('qrcode');
const path = require('path');
const fs = require('fs');

const C = {
  dark:      '#111827',
  grayBg:    '#f9fafb',
  grayBorder:'#e5e7eb',
  muted:     '#4b5563',
  subtle:    '#9ca3af',
  white:     '#ffffff',
  brand:     '#4f46e5',
};

const FONT_DIR = path.join(__dirname, '..', 'assets', 'fonts');
const FONTS = {
  regular: path.join(FONT_DIR, 'Inter-Regular.ttf'),
  bold:    path.join(FONT_DIR, 'Inter-Bold.ttf'),
};

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

async function buildQrBuffer(url) {
  return QRCode.toBuffer(url, {
    type: 'png',
    width: 260,
    margin: 1,
    color: {
      dark: '#111827',
      light: '#ffffff',
    },
  });
}

/**
 * Generates a clean, modern security cover page buffer (matching Blinkit slip style)
 * @param {object} order
 * @param {object} user
 * @param {string} scanUrl
 * @param {'FRONT' | 'BACK'} pageType
 */
async function generateCoverPage(order, user, scanUrl, pageType = 'FRONT') {
  const qrBuffer = await buildQrBuffer(scanUrl);

  return new Promise((resolve, reject) => {
    const chunks = [];
    const doc = new PDFKitDocument({ size: 'A4', margin: 0 });

    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const W = doc.page.width;   // 595.28
    const H = doc.page.height;  // 841.89

    // White clean canvas
    doc.rect(0, 0, W, H).fill(C.white);

    // Top subtle disclaimer (matching Blinkit top text)
    try { doc.font(FONTS.regular); } catch { doc.font('Helvetica'); }
    doc.fillColor('#6b7280').fontSize(9).text(
      pageType === 'FRONT'
        ? 'This page was printed for ensuring security and privacy of your documents while printing'
        : 'End of print job · This page ensures confidentiality and separation of your documents',
      40, 48, { width: W - 80, align: 'center' }
    );

    // Top right decorative corner fold / tab (matching Blinkit corner triangle)
    doc.save();
    doc.moveTo(W - 45, 0).lineTo(W, 0).lineTo(W, 45).closePath().fill('#374151');
    doc.restore();

    // Brand Logo / Header
    try { doc.font(FONTS.bold); } catch { doc.font('Helvetica-Bold'); }
    doc.fillColor(C.dark).fontSize(34).text('inks', 40, 105, { width: W - 80, align: 'center' });

    try { doc.font(FONTS.bold); } catch { doc.font('Helvetica-Bold'); }
    doc.fillColor(C.dark).fontSize(11).text('Inks by Trackify', 40, 145, { width: W - 80, align: 'center' });

    try { doc.font(FONTS.regular); } catch { doc.font('Helvetica'); }
    doc.fillColor('#6b7280').fontSize(8.5).text('PROFESSIONAL PRINT & DELIVERY', 40, 160, { width: W - 80, align: 'center', characterSpacing: 1.5 });

    // Main Details Card (Centered rounded box with soft border)
    const cardX = 65;
    const cardY = 200;
    const cardW = W - 130;
    const cardH = 340;

    doc.save();
    roundedRect(doc, cardX, cardY, cardW, cardH, 16);
    doc.lineWidth(1).strokeColor('#e5e7eb').fill('#fcfcfd');
    doc.restore();

    let rowY = cardY + 22;
    const drawRow = (label, value) => {
      try { doc.font(FONTS.regular); } catch { doc.font('Helvetica'); }
      doc.fillColor('#4b5563').fontSize(11).text(label, cardX + 28, rowY, { continued: false });

      try { doc.font(FONTS.bold); } catch { doc.font('Helvetica-Bold'); }
      doc.fillColor(C.dark).fontSize(11.5).text(`-   ${value}`, cardX + 175, rowY, { continued: false });
      rowY += 26;
    };

    drawRow('Order ID', order.orderNumber || `#${order.id}`);
    drawRow('Customer', user?.name || 'Customer');
    drawRow('Total Billable Pages', `${order.totalPages || 1} Pages`);
    drawRow('Print Mode', `${order.colorMode === 'COLOR' ? 'Colour' : 'B&W'} · ${order.sides === 'DOUBLE' ? 'Double sided' : 'Single sided'}`);
    drawRow('Copies', String(order.copies || 1));
    if (order.binding && order.binding !== 'none') {
      drawRow('Binding', order.binding);
    }

    // QR Code Box inside card
    const qrSize = 135;
    const qrX = (W - qrSize) / 2;
    const qrY = rowY + 12;

    doc.image(qrBuffer, qrX, qrY, { width: qrSize, height: qrSize });

    try { doc.font(FONTS.regular); } catch { doc.font('Helvetica'); }
    doc.fillColor('#4b5563').fontSize(8.5).text(
      pageType === 'FRONT'
        ? 'Printer Admin: Scan to mark delivered  |  Customer: Scan for feedback'
        : 'Customer: Scan to rate your print quality (1-5 Stars) & suggest features',
      cardX + 10, qrY + qrSize + 10, { width: cardW - 20, align: 'center' }
    );

    // Tagline below the card
    try { doc.font(FONTS.regular); } catch { doc.font('Helvetica'); }
    doc.fillColor('#1f2937').fontSize(12).text(
      'Order printouts and more, all in one single order!',
      40, cardY + cardH + 40, { width: W - 80, align: 'center' }
    );

    // Bottom dark pill banner (matching Blinkit bottom footer)
    const bannerH = 46;
    const bannerW = W - 80;
    const bannerX = 40;
    const bannerY = H - bannerH - 40;

    doc.save();
    roundedRect(doc, bannerX, bannerY, bannerW, bannerH, 12);
    doc.fill('#27272a');
    doc.restore();

    try { doc.font(FONTS.bold); } catch { doc.font('Helvetica-Bold'); }
    doc.fillColor(C.white).fontSize(9).text(
      'Thank you for ordering from Inks by Trackify.',
      bannerX + 10, bannerY + 11, { width: bannerW - 20, align: 'center' }
    );

    try { doc.font(FONTS.regular); } catch { doc.font('Helvetica'); }
    doc.fillColor('#d4d4d8').fontSize(7.5).text(
      'Share your experience with us by scanning the QR code above · Powered by Trackify',
      bannerX + 10, bannerY + 26, { width: bannerW - 20, align: 'center' }
    );

    doc.end();
  });
}

/**
 * Creates a single unified PDF containing:
 *  [Page 1: Front Security Cover]
 *  + [Pages 2..N+1: Original Customer Document Pages]
 *  + [Page N+2: Back Security Cover]
 *
 * @param {object} order - Prisma order
 * @param {string} originalFilePath - Path on disk to original file
 * @param {string} scanUrl - QR scan link
 * @returns {Promise<Buffer>} Combined PDF buffer
 */
async function generateMergedPrintDocument(order, originalFilePath, scanUrl) {
  const user = order.user || {};

  // 1. Generate front and back cover pages as PDF buffers
  const [frontCoverBytes, backCoverBytes] = await Promise.all([
    generateCoverPage(order, user, scanUrl, 'FRONT'),
    generateCoverPage(order, user, scanUrl, 'BACK'),
  ]);

  const mergedPdf = await PDFLibDoc.create();

  // 2. Load front & back covers into pdf-lib
  const frontDoc = await PDFLibDoc.load(frontCoverBytes);
  const backDoc = await PDFLibDoc.load(backCoverBytes);

  const [frontPage] = await mergedPdf.copyPages(frontDoc, [0]);
  const [backPage] = await mergedPdf.copyPages(backDoc, [0]);

  // Insert Front Cover as Page 1
  mergedPdf.addPage(frontPage);

  // 3. Load & embed original document pages
  if (originalFilePath && fs.existsSync(originalFilePath)) {
    const ext = path.extname(originalFilePath).toLowerCase();

    if (ext === '.pdf') {
      try {
        const originalBytes = fs.readFileSync(originalFilePath);
        const originalPdf = await PDFLibDoc.load(originalBytes);
        const pageIndices = originalPdf.getPageIndices();
        const copiedPages = await mergedPdf.copyPages(originalPdf, pageIndices);
        for (const page of copiedPages) {
          mergedPdf.addPage(page);
        }
      } catch (pdfErr) {
        console.warn('Could not copy original PDF pages:', pdfErr.message);
      }
    } else if (['.png', '.jpg', '.jpeg'].includes(ext)) {
      try {
        const imageBytes = fs.readFileSync(originalFilePath);
        const img = ext === '.png'
          ? await mergedPdf.embedPng(imageBytes)
          : await mergedPdf.embedJpg(imageBytes);

        // A4 dimensions: 595.28 x 841.89
        const pageWidth = 595.28;
        const pageHeight = 841.89;
        const imgDims = img.scaleToFit(pageWidth - 40, pageHeight - 40);

        const imgPage = mergedPdf.addPage([pageWidth, pageHeight]);
        imgPage.drawImage(img, {
          x: (pageWidth - imgDims.width) / 2,
          y: (pageHeight - imgDims.height) / 2,
          width: imgDims.width,
          height: imgDims.height,
        });
      } catch (imgErr) {
        console.warn('Could not embed image in merged PDF:', imgErr.message);
      }
    }
  }

  // Insert Back Cover as the Last Page
  mergedPdf.addPage(backPage);

  const finalPdfBytes = await mergedPdf.save();
  return Buffer.from(finalPdfBytes);
}

module.exports = {
  generateCoverPage,
  generateMergedPrintDocument,
};
