const path = require('path');
const fs = require('fs');
const prisma = require('../config/db');
const { PDFDocument } = require('pdf-lib');
const AdmZip = require('adm-zip');
const { extractDocumentPageCount } = require('../services/pageCount.service');

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
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
];

const ALLOWED_EXTENSIONS = ['.pdf', '.png', '.jpg', '.jpeg', '.webp'];

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
    const ext = path.extname(file.originalname).toLowerCase();

    // Validate Phase 1 supported formats (PDF & Images)
    const isAllowed = ALLOWED_EXTENSIONS.includes(ext) || ALLOWED_TYPES.includes(file.mimetype);

    if (!isAllowed) {
      // Delete unsupported uploaded file
      try { fs.unlinkSync(file.path); } catch {}
      return res.status(400).json({
        message: 'For exact print fidelity, Phase 1 supports PDF documents (.pdf) and high-res images (.png, .jpg, .jpeg, .webp). Please save/export your document as PDF and upload.',
      });
    }

    let pageCount = null;
    
    try {
      pageCount = await extractDocumentPageCount(file.path, file.originalname, file.mimetype);
    } catch (parseErr) {
      console.warn('Could not extract page count for', file.originalname, parseErr.message);
      pageCount = 1;
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
 * List user's documents with rich sorting and order status
 * GET /api/documents?page=1&limit=15&search=&sortBy=&status=
 */
async function listDocuments(req, res) {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 15));
    const search = req.query.search || '';
    const sortBy = req.query.sortBy || 'created_desc';
    const statusFilter = req.query.status || '';

    const where = { userId: req.user.id };

    if (search) {
      where.originalName = { contains: search, mode: 'insensitive' };
    }

    if (statusFilter === 'PRINTED') {
      where.orders = { some: { orderStatus: { in: ['PRINTED', 'DELIVERED'] } } };
    } else if (statusFilter === 'IN_PROGRESS') {
      where.orders = { some: { orderStatus: { in: ['RECEIVED', 'PROCESSING'] } } };
    } else if (statusFilter === 'DRAFT') {
      where.orders = { none: {} };
    }

    // Dynamic sorting
    let orderBy = { createdAt: 'desc' };
    if (sortBy === 'created_asc') {
      orderBy = { createdAt: 'asc' };
    } else if (sortBy === 'name_asc') {
      orderBy = { originalName: 'asc' };
    } else if (sortBy === 'name_desc') {
      orderBy = { originalName: 'desc' };
    } else if (sortBy === 'size_desc') {
      orderBy = { fileSize: 'desc' };
    } else if (sortBy === 'size_asc') {
      orderBy = { fileSize: 'asc' };
    } else if (sortBy === 'pages_desc') {
      orderBy = { pageCount: 'desc' };
    } else if (sortBy === 'pages_asc') {
      orderBy = { pageCount: 'asc' };
    }

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
          orders: {
            select: {
              id: true,
              orderNumber: true,
              orderStatus: true,
              createdAt: true,
            },
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
        skip: (page - 1) * limit,
        take: limit,
        orderBy,
      }),
      prisma.document.count({ where }),
    ]);

    // Format documents with calculated print status
    const formattedDocs = documents.map((doc) => {
      const latestOrder = doc.orders?.[0];
      const isPrintingInProgress = Boolean(latestOrder && ['RECEIVED', 'PROCESSING'].includes(latestOrder.orderStatus));
      const isPrinted = Boolean(latestOrder && ['PRINTED', 'DELIVERED'].includes(latestOrder.orderStatus));

      return {
        id: doc.id,
        originalName: doc.originalName,
        mimeType: doc.mimeType,
        fileSize: doc.fileSize,
        pageCount: doc.pageCount,
        status: doc.status,
        createdAt: doc.createdAt,
        latestOrder: latestOrder || null,
        isPrintingInProgress,
        isPrinted,
        canDelete: !isPrintingInProgress,
      };
    });

    res.json({
      documents: formattedDocs,
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
 * Blocks deletion if document is currently in progress / not yet printed
 */
async function deleteDocument(req, res) {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ message: 'Invalid document ID' });

    const document = await prisma.document.findUnique({
      where: { id },
      include: {
        orders: {
          select: { id: true, orderNumber: true, orderStatus: true },
        },
      },
    });

    if (!document) {
      return res.status(404).json({ message: 'Document not found' });
    }

    // Only owner or staff (ADMIN / PRINTER_ADMIN) can delete
    if (document.userId !== req.user.id && !STAFF_ROLES.includes(req.user.role)) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Check if document is linked to any active unprinted order
    const activeOrder = document.orders?.find((o) => ['RECEIVED', 'PROCESSING'].includes(o.orderStatus));
    if (activeOrder) {
      return res.status(400).json({
        message: `Cannot delete "${document.originalName}" because it is currently in print queue (#${activeOrder.orderNumber} - ${activeOrder.orderStatus}). Please wait until printing is complete or cancel the order first.`,
        isBlocked: true,
        orderNumber: activeOrder.orderNumber,
      });
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
 * Bulk delete documents
 * POST /api/documents/bulk-delete
 * Body: { documentIds: [1, 2, 3] }
 */
async function bulkDeleteDocuments(req, res) {
  try {
    const { documentIds } = req.body;
    if (!Array.isArray(documentIds) || documentIds.length === 0) {
      return res.status(400).json({ message: 'No document IDs provided for deletion.' });
    }

    const cleanIds = documentIds.map((id) => parseInt(id)).filter((id) => !isNaN(id));
    if (cleanIds.length === 0) {
      return res.status(400).json({ message: 'Invalid document IDs.' });
    }

    // Find all matching documents owned by user
    const documents = await prisma.document.findMany({
      where: {
        id: { in: cleanIds },
        userId: req.user.id,
      },
      include: {
        orders: {
          select: { id: true, orderNumber: true, orderStatus: true },
        },
      },
    });

    if (documents.length === 0) {
      return res.status(404).json({ message: 'No documents found to delete.' });
    }

    // Check for unprinted active orders
    const blockedDocs = [];
    const deletableDocs = [];

    for (const doc of documents) {
      const activeOrder = doc.orders?.find((o) => ['RECEIVED', 'PROCESSING'].includes(o.orderStatus));
      if (activeOrder) {
        blockedDocs.push({
          id: doc.id,
          name: doc.originalName,
          orderNumber: activeOrder.orderNumber,
          status: activeOrder.orderStatus,
        });
      } else {
        deletableDocs.push(doc);
      }
    }

    if (blockedDocs.length > 0) {
      const blockedNames = blockedDocs.map((d) => `"${d.name}" (Order #${d.orderNumber})`).join(', ');
      return res.status(400).json({
        message: `Cannot delete: Some selected documents are currently in the print queue: ${blockedNames}. Please wait until printing is complete.`,
        blocked: blockedDocs,
      });
    }

    // Proceed to delete physical files
    for (const doc of deletableDocs) {
      const safePath = resolveSafeDocumentPath(doc);
      if (safePath && fs.existsSync(safePath)) {
        try { fs.unlinkSync(safePath); } catch {}
      }
    }

    const deletableIds = deletableDocs.map((d) => d.id);
    await prisma.document.deleteMany({
      where: { id: { in: deletableIds } },
    });

    res.json({
      message: `Successfully deleted ${deletableIds.length} document(s).`,
      deletedCount: deletableIds.length,
    });
  } catch (err) {
    console.error('BulkDeleteDocuments error:', err);
    res.status(500).json({ message: 'Failed to delete documents' });
  }
}

/**
 * Admin: List all documents with filtering & sorting
 * GET /api/admin/documents?page=1&limit=15&search=&sortBy=&type=
 */
async function adminListDocuments(req, res) {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 15));
    const search = req.query.search || '';
    const sortBy = req.query.sortBy || 'created_desc';
    const typeFilter = req.query.type || '';

    const where = {};
    if (search) {
      where.OR = [
        { originalName: { contains: search, mode: 'insensitive' } },
        { user: { name: { contains: search, mode: 'insensitive' } } },
        { user: { email: { contains: search, mode: 'insensitive' } } },
      ];
    }

    if (typeFilter === 'pdf') {
      where.mimeType = 'application/pdf';
    } else if (typeFilter === 'image') {
      where.mimeType = { startsWith: 'image/' };
    }

    let orderBy = { createdAt: 'desc' };
    if (sortBy === 'created_asc') orderBy = { createdAt: 'asc' };
    else if (sortBy === 'size_desc') orderBy = { fileSize: 'desc' };
    else if (sortBy === 'size_asc') orderBy = { fileSize: 'asc' };
    else if (sortBy === 'name_asc') orderBy = { originalName: 'asc' };
    else if (sortBy === 'pages_desc') orderBy = { pageCount: 'desc' };

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
          user: {
            select: { id: true, name: true, email: true },
          },
          orders: {
            select: { id: true, orderNumber: true, orderStatus: true },
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
        skip: (page - 1) * limit,
        take: limit,
        orderBy,
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
  bulkDeleteDocuments,
  adminListDocuments,
};
