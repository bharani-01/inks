const express = require('express');
const router = express.Router();
const authenticate = require('../middleware/auth');
const requireRole = require('../middleware/roleCheck');
const { getScanInfo, markDelivered, updateOrderStatusByScan, submitFeedback } = require('../controllers/scan.controller');

// Public: look up token info (no auth needed — public QR scan)
router.get('/:token', getScanInfo);

// Printer staff status update actions (requires auth + printer role)
router.post('/:token/deliver', authenticate, requireRole('ADMIN', 'PRINTER_ADMIN'), markDelivered);
router.post('/:token/status', authenticate, requireRole('ADMIN', 'PRINTER_ADMIN'), updateOrderStatusByScan);

// Customer feedback (public — no auth required)
router.post('/:token/feedback', submitFeedback);

module.exports = router;
