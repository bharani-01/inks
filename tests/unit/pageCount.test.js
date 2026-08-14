const fs = require('fs');
const path = require('path');
const { PDFDocument } = require('pdf-lib');
const { extractDocumentPageCount } = require('../../services/pageCount.service');

describe('Page Count Service (services/pageCount.service.js)', () => {
  const tempDir = path.join(__dirname, '..', '..', 'scratch', 'test_tmp');

  beforeAll(() => {
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
  });

  afterAll(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('should return 1 for nonexistent file paths', async () => {
    const result = await extractDocumentPageCount('/invalid/path/nonexistent.pdf', 'nonexistent.pdf');
    expect(result).toBe(1);
  });

  it('should return 1 for image files (png, jpg)', async () => {
    const imgPath = path.join(tempDir, 'sample.jpg');
    fs.writeFileSync(imgPath, 'fake-image-bytes');

    const result = await extractDocumentPageCount(imgPath, 'sample.jpg', 'image/jpeg');
    expect(result).toBe(1);
  });

  it('should calculate page count for text files based on line density', async () => {
    const txtPath = path.join(tempDir, 'doc.txt');
    // Write 120 lines
    const lines = Array.from({ length: 120 }, (_, i) => `Line ${i + 1}`).join('\n');
    fs.writeFileSync(txtPath, lines, 'utf8');

    // 120 lines / 50 lines per page = 2.4 -> Math.ceil = 3 pages
    const result = await extractDocumentPageCount(txtPath, 'doc.txt', 'text/plain');
    expect(result).toBe(3);
  });

  it('should accurately count pages in a real generated multi-page PDF document', async () => {
    const pdfDoc = await PDFDocument.create();
    pdfDoc.addPage();
    pdfDoc.addPage();
    pdfDoc.addPage(); // 3 pages
    const pdfBytes = await pdfDoc.save();

    const pdfPath = path.join(tempDir, 'multi_page.pdf');
    fs.writeFileSync(pdfPath, pdfBytes);

    const result = await extractDocumentPageCount(pdfPath, 'multi_page.pdf', 'application/pdf');
    expect(result).toBe(3);
  });
});
