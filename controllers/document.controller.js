const path = require('path');
const fs = require('fs');
const prisma = require('../config/db');
const { PDFDocument } = require('pdf-lib');
const AdmZip = require('adm-zip');

const STAFF_ROLES = ['ADMIN', 'PRINTER_ADMIN'];

const UPLOADS_DIR = path.normalize(path.resolve(__dirname, '..', 'uploads'));

// Ensure uploads directory exists
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

/**
 * Validates that a file path strictly resolves inside the authorized uploads directory
 * to prevent directory traversal and arbitrary file access vulnerabilities.
 */
function resolveSafeDocumentPath(document) {
  if (!document) return null;
  const fileName = document.fileName || (document.filePath ? path.basename(document.filePath) : null);
  if (!fileName) return null;
  const cleanName = path.basename(fileName);
  return path.join(UPLOADS_DIR, cleanName);
}

const ALLOWED_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
  'image/gif',
  'image/svg+xml',
];

/**
 * Upload document(s)
 * POST /api/documents/upload
 */
async function upload(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    const file = req.file;

    // Validate type (allow any document or image)
    const isDocOrImage = file.mimetype.startsWith('image/') || 
                         file.mimetype.startsWith('application/') || 
                         file.mimetype.startsWith('text/');

    if (!isDocOrImage && !ALLOWED_TYPES.includes(file.mimetype)) {
      // Delete uploaded file
      fs.unlinkSync(file.path);
      return res.status(400).json({
        message: 'Invalid file format.',
      });
    }

    let pageCount = null;
    
    try {
      const ext = path.extname(file.originalname).toLowerCase();
      const isPdf = file.mimetype === 'application/pdf' || ext === '.pdf';
      const isPptx = file.mimetype.includes('presentation') || ext === '.pptx' || ext === '.ppt';
      const isDocx = file.mimetype.includes('wordprocessingml') || ext === '.docx' || ext === '.doc';

      if (isPdf) {
        const dataBuffer = fs.readFileSync(file.path);
        const pdfDoc = await PDFDocument.load(dataBuffer, { ignoreEncryption: true });
        pageCount = pdfDoc.getPageCount();
      } else if (isPptx) {
        try {
          const zip = new AdmZip(file.path);
          // 1. Count actual slide files in ppt/slides/
          const slideEntries = zip.getEntries().filter((e) => /^ppt\/slides\/slide\d+\.xml$/i.test(e.entryName));
          if (slideEntries.length > 0) {
            pageCount = slideEntries.length;
          } else {
            // 2. Fallback to app.xml <Slides> tag
            const appXmlEntry = zip.getEntry('docProps/app.xml');
            if (appXmlEntry) {
              const appXml = appXmlEntry.getData().toString('utf8');
              const slideMatch = appXml.match(/<(?:\w+:)?Slides>(\d+)<\/(?:\w+:)?Slides>/i);
              if (slideMatch && slideMatch[1]) {
                pageCount = parseInt(slideMatch[1], 10);
              }
            }
          }
        } catch (pptxErr) {
          console.warn('PPTX count extraction warning:', pptxErr.message);
        }
      } else if (isDocx) {
        try {
          const zip = new AdmZip(file.path);
          const appXmlEntry = zip.getEntry('docProps/app.xml');
          if (appXmlEntry) {
            const appXml = appXmlEntry.getData().toString('utf8');
            const pageMatch = appXml.match(/<(?:\w+:)?Pages>(\d+)<\/(?:\w+:)?Pages>/i);
            if (pageMatch && pageMatch[1]) {
              pageCount = parseInt(pageMatch[1], 10);
            }
          }
        } catch (docxErr) {
          console.warn('DOCX count extraction warning:', docxErr.message);
        }
      }
    } catch (parseErr) {
      console.warn('Could not extract page count for', file.originalname, parseErr.message);
    }

    const document = await prisma.document.create({
      data: {
        userId: req.user.id,
        fileName: file.filename,
        originalName: file.originalname,
        mimeType: file.mimetype,
        fileSize: file.size,
        pageCount: pageCount,
        filePath: file.path,
      },
    });

    res.status(201).json({
      document: {
        id: document.id,
        originalName: document.originalName,
        mimeType: document.mimeType,
        fileSize: document.fileSize,
        pageCount: document.pageCount,
        status: document.status,
        createdAt: document.createdAt,
      },
      message: 'Document uploaded successfully',
    });
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ message: 'Failed to upload document' });
  }
}

/**
 * List user's documents
 * GET /api/documents?page=1&limit=10
 */
async function listDocuments(req, res) {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 10));

    const [documents, total] = await Promise.all([
      prisma.document.findMany({
        where: { userId: req.user.id },
        select: {
          id: true,
          originalName: true,
          mimeType: true,
          fileSize: true,
          pageCount: true,
          status: true,
          createdAt: true,
        },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.document.count({ where: { userId: req.user.id } }),
    ]);

    res.json({
      documents,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    console.error('ListDocuments error:', err);
    res.status(500).json({ message: 'Failed to load documents' });
  }
}

/**
 * Get document details
 * GET /api/documents/:id
 */
async function getDocument(req, res) {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ message: 'Invalid document ID' });

    const document = await prisma.document.findUnique({ where: { id } });

    if (!document) {
      return res.status(404).json({ message: 'Document not found' });
    }

    // Only owner or staff (ADMIN / PRINTER_ADMIN) can access
    if (document.userId !== req.user.id && !STAFF_ROLES.includes(req.user.role)) {
      return res.status(403).json({ message: 'Access denied' });
    }

    res.json({
      document: {
        id: document.id,
        originalName: document.originalName,
        mimeType: document.mimeType,
        fileSize: document.fileSize,
        pageCount: document.pageCount,
        status: document.status,
        createdAt: document.createdAt,
      },
    });
  } catch (err) {
    console.error('GetDocument error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
}

/**
 * Preview/download document
 * GET /api/documents/:id/preview
 */
async function previewDocument(req, res) {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ message: 'Invalid document ID' });

    const document = await prisma.document.findUnique({ where: { id } });

    if (!document) {
      return res.status(404).json({ message: 'Document not found' });
    }

    // Only owner or staff (ADMIN / PRINTER_ADMIN) can preview/download
    if (document.userId !== req.user.id && !STAFF_ROLES.includes(req.user.role)) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Check if file was auto-deleted after printing
    if (document.filePath && document.filePath.startsWith('[AUTO_DELETED]')) {
      return res.status(410).json({ message: 'Document file was auto-deleted 30 minutes after printing for privacy & security.' });
    }

    // Safely resolve file on disk
    const safeFilePath = resolveSafeDocumentPath(document);

    // Check file exists on disk
    if (!safeFilePath || !fs.existsSync(safeFilePath)) {
      return res.status(404).json({ message: 'File not found on server or auto-deleted.' });
    }

    // Set proper headers for inline display or download
    const isDownload = req.query.download === 'true' || req.query.download === '1';
    const cleanFilename = (document.originalName || 'document').replace(/[^\w.-]/g, '_');
    const encodedFilename = encodeURIComponent(document.originalName || 'document');

    let contentType = document.mimeType || 'application/octet-stream';
    const ext = path.extname(document.originalName || '').toLowerCase();
    if (ext === '.pdf') contentType = 'application/pdf';
    else if (ext === '.png') contentType = 'image/png';
    else if (ext === '.jpg' || ext === '.jpeg') contentType = 'image/jpeg';
    else if (ext === '.webp') contentType = 'image/webp';
    else if (ext === '.svg') contentType = 'image/svg+xml';
    else if (ext === '.txt') contentType = 'text/plain; charset=utf-8';
    
    res.setHeader('Content-Type', contentType);
    res.setHeader('Accept-Ranges', 'bytes');

    if (isDownload) {
      res.setHeader('Content-Disposition', `attachment; filename="${cleanFilename}"; filename*=UTF-8''${encodedFilename}`);
    } else {
      res.setHeader('Content-Disposition', 'inline');
    }

    const stream = fs.createReadStream(safeFilePath);
    stream.pipe(res);
  } catch (err) {
    console.error('PreviewDocument error:', err);
    res.status(500).json({ message: 'Failed to preview/download document' });
  }
}

/**
 * Delete document
 * DELETE /api/documents/:id
 */
async function deleteDocument(req, res) {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ message: 'Invalid document ID' });

    const document = await prisma.document.findUnique({ where: { id } });

    if (!document) {
      return res.status(404).json({ message: 'Document not found' });
    }

    // Only owner or staff (ADMIN / PRINTER_ADMIN) can delete
    if (document.userId !== req.user.id && !STAFF_ROLES.includes(req.user.role)) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Delete physical file safely
    const safeFilePath = resolveSafeDocumentPath(document);
    if (safeFilePath && fs.existsSync(safeFilePath)) {
      try {
        fs.unlinkSync(safeFilePath);
      } catch (unlinkErr) {
        console.warn('Could not unlink physical file:', unlinkErr.message);
      }
    }

    // Delete from database
    await prisma.document.delete({ where: { id } });

    res.json({ message: 'Document deleted successfully' });
  } catch (err) {
    console.error('DeleteDocument error:', err);
    res.status(500).json({ message: 'Failed to delete document' });
  }
}

/**
 * Admin: List all documents
 * GET /api/admin/documents?page=1&limit=10&search=
 */
async function adminListDocuments(req, res) {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 10));
    const search = req.query.search || '';

    const where = {};
    if (search) {
      where.OR = [
        { originalName: { contains: search, mode: 'insensitive' } },
        { user: { name: { contains: search, mode: 'insensitive' } } },
        { user: { email: { contains: search, mode: 'insensitive' } } },
      ];
    }

    const [documents, total] = await Promise.all([
      prisma.document.findMany({
        where,
        select: {
          id: true,
          originalName: true,
          mimeType: true,
          fileSize: true,
          status: true,
          createdAt: true,
          user: {
            select: { id: true, name: true, email: true },
          },
        },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.document.count({ where }),
    ]);

    res.json({
      documents,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    console.error('AdminListDocuments error:', err);
    res.status(500).json({ message: 'Failed to load documents' });
  }
}

module.exports = {
  upload,
  listDocuments,
  getDocument,
  previewDocument,
  deleteDocument,
  adminListDocuments,
};
