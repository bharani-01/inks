const express = require('express');
const multer = require('multer');
const path = require('path');
const router = express.Router();
const authenticate = require('../middleware/auth');
const requireRole = require('../middleware/roleCheck');
const {
  upload,
  listDocuments,
  getDocument,
  previewDocument,
  deleteDocument,
  adminListDocuments,
} = require('../controllers/document.controller');

// Multer config
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '..', 'uploads'));
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, `doc-${uniqueSuffix}${ext}`);
  },
});

const uploadMiddleware = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

// All routes require authentication
router.use(authenticate);

// Admin / Staff document listing route (must be before /:id)
router.get('/admin', requireRole('ADMIN', 'PRINTER_ADMIN'), adminListDocuments);

// User document routes
router.post('/upload', uploadMiddleware.single('document'), upload);
router.get('/', listDocuments);
router.get('/:id', getDocument);
router.get('/:id/preview', previewDocument);
router.delete('/:id', deleteDocument);

module.exports = router;
