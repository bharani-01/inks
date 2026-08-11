/**
 * Multi-Engine Document Page & Slide Counting Service
 *
 * Uses 3-4 independent verification engines per document type:
 *
 * PDF:
 *   1. pdf-lib (binary dictionary tree)
 *   2. pdf-parse (font & object stream parser)
 *   3. Native XRef / Catalog regex (/Type /Page and /Count)
 *
 * PPTX / PPT:
 *   1. Direct slide XML entry enumeration (ppt/slides/slide*.xml)
 *   2. Presentation relationship tree (ppt/_rels/presentation.xml.rels)
 *   3. Presentation manifest slide registry (ppt/presentation.xml <p:sldId>)
 *   4. OpenXML document properties (docProps/app.xml <Slides>)
 *
 * DOCX / DOC:
 *   1. Full A4 print layout rendering via Headless Engine + pdf-lib
 *   2. Word OpenXML page breaks (<w:lastRenderedPageBreak/> & <w:br w:type="page"/>)
 *   3. OpenXML document properties (docProps/app.xml <Pages>)
 *   4. Typographic density calculation (word & character distribution)
 *
 * XLSX / XLS:
 *   1. Worksheet file enumeration (xl/worksheets/sheet*.xml)
 *   2. Workbook manifest (xl/workbook.xml <sheet>)
 *
 * Images:
 *   1. Single page (1)
 */

const { PDFDocument: PDFLibDoc } = require('pdf-lib');
const pdfParse = require('pdf-parse');
const AdmZip = require('adm-zip');
const path = require('path');
const fs = require('fs');
const { convertTextOrDocxToPdfBytes } = require('./coverPage.service');

/**
 * Multi-engine PDF page counter
 */
async function countPdfPages(filePath) {
  const counts = [];
  const buffer = fs.readFileSync(filePath);

  // Engine 1: pdf-lib
  try {
    const pdfDoc = await PDFLibDoc.load(buffer, { ignoreEncryption: true });
    const c1 = pdfDoc.getPageCount();
    if (c1 > 0) counts.push({ engine: 'pdf-lib', count: c1 });
  } catch (err1) {
    // Engine 1 failed
  }

  // Engine 2: pdf-parse
  try {
    const data = await pdfParse(buffer);
    if (data && data.numpages > 0) {
      counts.push({ engine: 'pdf-parse', count: data.numpages });
    }
  } catch (err2) {
    // Engine 2 failed
  }

  // Engine 3: Native binary regex inspection
  try {
    const raw = buffer.toString('latin1');
    const pageMatches = raw.match(/\/Type\s*\/Page\b/g);
    if (pageMatches && pageMatches.length > 0) {
      counts.push({ engine: 'xref-regex', count: pageMatches.length });
    }
  } catch (err3) {
    // Engine 3 failed
  }

  if (counts.length === 0) return 1;

  // If consensus or max
  const maxCount = Math.max(...counts.map((c) => c.count));
  return Math.max(1, maxCount);
}

/**
 * Multi-engine PPTX slide counter
 */
function countPptxSlides(filePath) {
  const counts = [];

  try {
    const zip = new AdmZip(filePath);
    const entries = zip.getEntries();

    // Engine 1: Count slide XML files in ppt/slides/
    const slideFiles = entries.filter((e) => /^ppt\/slides\/slide\d+\.xml$/i.test(e.entryName));
    if (slideFiles.length > 0) {
      counts.push({ engine: 'slide-xml-files', count: slideFiles.length });
    }

    // Engine 2: Count relationship targets in ppt/_rels/presentation.xml.rels
    const relsEntry = zip.getEntry('ppt/_rels/presentation.xml.rels');
    if (relsEntry) {
      const relsXml = relsEntry.getData().toString('utf8');
      const relMatches = relsXml.match(/Type="[^"]*\/slide"/gi) || relsXml.match(/Target="slides\/slide\d+\.xml"/gi);
      if (relMatches && relMatches.length > 0) {
        counts.push({ engine: 'presentation-rels', count: relMatches.length });
      }
    }

    // Engine 3: Count <p:sldId> in ppt/presentation.xml
    const presEntry = zip.getEntry('ppt/presentation.xml');
    if (presEntry) {
      const presXml = presEntry.getData().toString('utf8');
      const sldMatches = presXml.match(/<p:sldId\b[^>]*>/gi);
      if (sldMatches && sldMatches.length > 0) {
        counts.push({ engine: 'presentation-manifest', count: sldMatches.length });
      }
    }

    // Engine 4: Check <Slides> tag in docProps/app.xml
    const appXmlEntry = zip.getEntry('docProps/app.xml');
    if (appXmlEntry) {
      const appXml = appXmlEntry.getData().toString('utf8');
      const match = appXml.match(/<(?:\w+:)?Slides>(\d+)<\/(?:\w+:)?Slides>/i);
      if (match && match[1]) {
        const num = parseInt(match[1], 10);
        if (num > 0) counts.push({ engine: 'app-xml-slides', count: num });
      }
    }
  } catch (pptxErr) {
    console.warn('PPTX multi-engine count error:', pptxErr.message);
  }

  if (counts.length === 0) return 1;
  const maxCount = Math.max(...counts.map((c) => c.count));
  return Math.max(1, maxCount);
}

/**
 * Multi-engine DOCX page counter
 */
async function countDocxPages(filePath, ext) {
  const counts = [];

  // Engine 1: High-fidelity layout renderer
  try {
    const pdfBytes = await convertTextOrDocxToPdfBytes(filePath, ext);
    if (pdfBytes && pdfBytes.length > 0) {
      const pdfDoc = await PDFLibDoc.load(pdfBytes, { ignoreEncryption: true });
      const renderedCount = pdfDoc.getPageCount();
      if (renderedCount > 0) {
        counts.push({ engine: 'layout-renderer', count: renderedCount });
      }
    }
  } catch (renderErr) {
    console.warn('DOCX layout renderer count warning:', renderErr.message);
  }

  // Engine 2: OpenXML page break markers (<w:lastRenderedPageBreak/> & <w:br w:type="page"/>)
  try {
    const zip = new AdmZip(filePath);
    const docXmlEntry = zip.getEntry('word/document.xml');
    if (docXmlEntry) {
      const docXml = docXmlEntry.getData().toString('utf8');
      const renderedBreaks = (docXml.match(/<w:lastRenderedPageBreak\b[^>]*\/>/gi) || []).length;
      const manualBreaks = (docXml.match(/<w:br\b[^>]*w:type="page"[^>]*\/>/gi) || []).length;
      const totalBreaks = renderedBreaks + manualBreaks;
      if (totalBreaks > 0) {
        counts.push({ engine: 'openxml-breaks', count: totalBreaks + 1 });
      }
    }
  } catch (zipErr) {
    // ignore
  }

  // Engine 3: OpenXML docProps/app.xml <Pages> metadata
  try {
    const zip = new AdmZip(filePath);
    const appXmlEntry = zip.getEntry('docProps/app.xml');
    if (appXmlEntry) {
      const appXml = appXmlEntry.getData().toString('utf8');
      const match = appXml.match(/<(?:\w+:)?Pages>(\d+)<\/(?:\w+:)?Pages>/i);
      if (match && match[1]) {
        const num = parseInt(match[1], 10);
        if (num > 0) counts.push({ engine: 'app-xml-pages', count: num });
      }
    }
  } catch {}

  // Engine 4: Word count / character density estimation
  try {
    const zip = new AdmZip(filePath);
    const docXmlEntry = zip.getEntry('word/document.xml');
    if (docXmlEntry) {
      const docXml = docXmlEntry.getData().toString('utf8');
      const textOnly = docXml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      const words = textOnly.split(/\s+/).filter(Boolean).length;
      if (words > 0) {
        // Standard A4 document has ~350-400 words per single-spaced page
        const estimatedPages = Math.max(1, Math.ceil(words / 350));
        counts.push({ engine: 'density-estimate', count: estimatedPages });
      }
    }
  } catch {}

  if (counts.length === 0) return 1;

  // Prefer Engine 1 (layout-renderer) if available, otherwise max of accurate engines
  const layoutResult = counts.find((c) => c.engine === 'layout-renderer');
  if (layoutResult) return layoutResult.count;

  const validCounts = counts.filter((c) => c.count > 0).map((c) => c.count);
  return validCounts.length > 0 ? Math.max(...validCounts) : 1;
}

/**
 * Multi-engine XLSX worksheet counter
 */
function countXlsxPages(filePath) {
  try {
    const zip = new AdmZip(filePath);
    const entries = zip.getEntries();
    const sheetFiles = entries.filter((e) => /^xl\/worksheets\/sheet\d+\.xml$/i.test(e.entryName));
    if (sheetFiles.length > 0) return sheetFiles.length;

    const wbEntry = zip.getEntry('xl/workbook.xml');
    if (wbEntry) {
      const wbXml = wbEntry.getData().toString('utf8');
      const sheetMatches = wbXml.match(/<sheet\b[^>]*>/gi);
      if (sheetMatches && sheetMatches.length > 0) return sheetMatches.length;
    }
  } catch {}
  return 1;
}

/**
 * Main Entry Point: Accurately calculates page count using multi-library consensus
 * @param {string} filePath - Absolute path on disk
 * @param {string} originalName - Original filename
 * @param {string} mimeType - Uploaded MIME type
 * @returns {Promise<number>} pageCount (minimum 1)
 */
async function extractDocumentPageCount(filePath, originalName, mimeType = '') {
  if (!filePath || !fs.existsSync(filePath)) return 1;

  const ext = path.extname(originalName || filePath).toLowerCase();
  const mime = (mimeType || '').toLowerCase();

  // 1. PDF
  if (ext === '.pdf' || mime === 'application/pdf') {
    return await countPdfPages(filePath);
  }

  // 2. PowerPoint (.pptx / .ppt)
  if (ext === '.pptx' || ext === '.ppt' || mime.includes('presentation')) {
    return countPptxSlides(filePath);
  }

  // 3. Word Documents (.docx / .doc)
  if (ext === '.docx' || ext === '.doc' || mime.includes('wordprocessingml') || mime.includes('msword')) {
    return await countDocxPages(filePath, ext);
  }

  // 4. Excel Spreadsheets (.xlsx / .xls)
  if (ext === '.xlsx' || ext === '.xls' || mime.includes('spreadsheetml') || mime.includes('excel')) {
    return countXlsxPages(filePath);
  }

  // 5. Images (PNG, JPG, JPEG, WEBP, GIF, SVG, BMP)
  if (['.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp', '.svg'].includes(ext) || mime.startsWith('image/')) {
    return 1;
  }

  // 6. Text / Markdown / Code / CSV
  if (['.txt', '.csv', '.md', '.log', '.json', '.xml'].includes(ext) || mime.startsWith('text/')) {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const lines = content.split('\n').length;
      return Math.max(1, Math.ceil(lines / 50));
    } catch {}
    return 1;
  }

  return 1;
}

module.exports = {
  extractDocumentPageCount,
  countPdfPages,
  countPptxSlides,
  countDocxPages,
};
