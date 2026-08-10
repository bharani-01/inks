const path = require('path');
const fs = require('fs');
const prisma = require('../config/db');
const pdfParse = require('pdf-parse');
const AdmZip = require('adm-zip');

const UPLOADS_DIR = path.normalize(path.resolve(__dirname, '..', 'uploads'));

// Ensure uploads directory exists
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

/**
 * Validates that a file path strictly resolves inside the authorized uploads directory
 * to prevent directory traversal and arbitrary file access vulnerabilities.
 */
function validateSafeFilePath(filePath) {
  if (!filePath || typeof filePath !== 'string') {
    throw new Error('Invalid file path specified');
  }
  const normalized = path.normalize(path.resolve(filePath));
  if (!normalized.startsWith(UPLOADS_DIR)) {
    throw new Error('Security Error: Path traversal attempt outside uploads directory blocked');
  }
  return normalized;
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
      if (file.mimetype === 'application/pdf') {
        const dataBuffer = fs.readFileSync(file.path);
        const pdfData = await pdfParse(dataBuffer, { pagerender: () => '' });
        pageCount = pdfData.numpages;
      } else if (file.mimetype.includes('presentation') || file.mimetype.includes('wordprocessingml')) {
        const zip = new AdmZip(file.path);
        const appXmlEntry = zip.getEntry('docProps/app.xml');
        if (appXmlEntry) {
          const appXml = appXmlEntry.getData().toString('utf8');
          const match = appXml.match(/<(?:\w+:)?(?:Pages|Slides)>(\d+)<\/(?:\w+:)?(?:Pages|Slides)>/i);
          if (match && match[1]) {
            pageCount = parseInt(match[1], 10);
          }
        }
        
        // Fallback for PPTX if app.xml fails
        if (!pageCount && file.mimetype.includes('presentation')) {
          const zipEntries = zip.getEntries();
          let slides = 0;
          zipEntries.forEach(zipEntry => {
            if (zipEntry.entryName.match(/^ppt\/slides\/slide\d+\.xml$/i)) slides++;
          });
          if (slides > 0) pageCount = slides;
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
 * List own documents
 * GET /api/documents?page=1&limit=10
 */
async function listDocuments(req, res) {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 10));

    const where = { userId: req.user.id };

    const [documents, total] = await Promise.all([
      prisma.document.findMany({
        where,
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

    // Only owner or admin can access
    if (document.userId !== req.user.id && req.user.role !== 'ADMIN') {
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

    // Only owner or admin can preview
    if (document.userId !== req.user.id && req.user.role !== 'ADMIN') {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Check if file was auto-deleted after printing
    if (document.filePath.startsWith('[AUTO_DELETED]')) {
      return res.status(410).json({ message: 'Document file was auto-deleted 30 minutes after printing for privacy & security.' });
    }

    // Validate path strictly stays inside uploads directory
    const safeFilePath = validateSafeFilePath(document.filePath);

    // Check file exists on disk
    if (!fs.existsSync(safeFilePath)) {
      return res.status(404).json({ message: 'File not found on server or auto-deleted.' });
    }

    // Set proper headers for inline display or download
    const safeFilename = encodeURIComponent(document.originalName);
    const isDownload = req.query.download === 'true';

    let contentType = document.mimeType || 'application/octet-stream';
    const ext = path.extname(document.originalName).toLowerCase();
    if (ext === '.pdf') contentType = 'application/pdf';
    else if (ext === '.png') contentType = 'image/png';
    else if (ext === '.jpg' || ext === '.jpeg') contentType = 'image/jpeg';
    else if (ext === '.webp') contentType = 'image/webp';
    else if (ext === '.svg') contentType = 'image/svg+xml';
    else if (ext === '.txt') contentType = 'text/plain; charset=utf-8';
    
    res.setHeader('Content-Type', contentType);
    res.setHeader('Accept-Ranges', 'bytes');

    if (isDownload) {
      res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}"; filename*=UTF-8''${safeFilename}`);
    } else {
      res.setHeader('Content-Disposition', 'inline');
    }

    const stream = fs.createReadStream(safeFilePath);
    stream.pipe(res);
  } catch (err) {
    console.error('PreviewDocument error:', err);
    res.status(500).json({ message: 'Failed to preview document' });
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

    // Only owner or admin can delete
    if (document.userId !== req.user.id && req.user.role !== 'ADMIN') {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Validate path strictly stays inside uploads directory before deletion
    if (!document.filePath.startsWith('[AUTO_DELETED]')) {
      const safeFilePath = validateSafeFilePath(document.filePath);
      if (fs.existsSync(safeFilePath)) {
        fs.unlinkSync(safeFilePath);
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
