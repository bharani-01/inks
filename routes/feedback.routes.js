const express = require('express');
const router = express.Router();
const authenticate = require('../middleware/auth');
const requireRole = require('../middleware/roleCheck');
const { getAllFeedback } = require('../controllers/feedback.controller');

// Admin and Printer Admin: view all feedback
router.get('/', authenticate, requireRole('ADMIN', 'PRINTER_ADMIN'), getAllFeedback);

module.exports = router;
