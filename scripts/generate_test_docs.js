const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

const targetDir = path.join(__dirname, '..', 'test_documents');
if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });

function createSamplePdf(filename, title, pagesCount, color = '#4F46E5') {
  return new Promise((resolve, reject) => {
    try {
      const filePath = path.join(targetDir, filename);
      const doc = new PDFDocument({ margin: 40, size: 'A4', bufferPages: true });
      const stream = fs.createWriteStream(filePath);
      doc.pipe(stream);

      for (let i = 1; i <= pagesCount; i++) {
        if (i > 1) doc.addPage();

        // Header Banner
        doc.rect(40, 40, 515, 60).fill(color);
        doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(18).text(title, 55, 55);
        doc.fillColor('#E0E7FF').font('Helvetica').fontSize(10).text(`Inks by Trackify - Test Document Sample (Page ${i} of ${pagesCount})`, 55, 82);

        // Page Body Content
        doc.fillColor('#1E293B').font('Helvetica-Bold').fontSize(14).text(`Section ${i}: Overview & Key Concepts`, 40, 120);
        doc.moveDown(0.5);

        const bodyText = `This is page ${i} of the sample document '${title}'. This document is auto-generated for testing page counts, multi-page visual selector previewing, duplex printing, and price calculations in Inks by Trackify.\n\n` +
          `Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.\n\n` +
          `Key Features Tested:\n` +
          `* Total page detection & range calculations (e.g. 1-${pagesCount})\n` +
          `* Color & Black & White print mode toggling\n` +
          `* Double-sided (Duplex) sheet reduction\n` +
          `* Spiral, Staple, and Thermal binding options\n` +
          `* High-resolution visual page thumbnail rendering`;

        doc.fillColor('#475569').font('Helvetica').fontSize(11).text(bodyText, 40, 145, { width: 515, lineGap: 4 });

        // Graphic Box
        doc.rect(40, 380, 515, 120).fillAndStroke('#F8FAFC', '#E2E8F0');
        doc.fillColor(color).font('Helvetica-Bold').fontSize(12).text(`Sample Preview Box - Page ${i}`, 60, 400);
        doc.fillColor('#64748B').font('Helvetica').fontSize(10).text(`Document ID: DOC-${Math.floor(1000 + Math.random()*9000)} | Created: ${new Date().toLocaleDateString()}`, 60, 420);

        // Footer
        doc.fillColor('#94A3B8').font('Helvetica').fontSize(9).text(`Page ${i} of ${pagesCount} - Inks Cloud Printing Platform`, 40, 780, { align: 'center', width: 515 });
      }

      doc.end();
      stream.on('finish', () => {
        console.log(`Created ${filename} (${pagesCount} pages)`);
        resolve();
      });
      stream.on('error', reject);
    } catch (err) {
      reject(err);
    }
  });
}

async function generateAll() {
  await createSamplePdf('Sample_Project_Report.pdf', 'Project Final Report 2026', 5, '#4F46E5');
  await createSamplePdf('Lab_Manual_Chapter_1.pdf', 'CS101 Lab Manual - Chapter 1', 3, '#059669');
  await createSamplePdf('Lecture_Notes_Unit_2.pdf', 'Unit 2: Distributed Systems', 8, '#D97706');
  await createSamplePdf('Resume_Template_2026.pdf', 'Professional Resume Template', 1, '#2563EB');
  console.log('\nSUCCESS: All test documents generated in:', targetDir);
}

generateAll().catch(console.error);
