const express = require('express');
const router = express.Router();
const authenticate = require('../middleware/auth');
const requireRole = require('../middleware/roleCheck');
const { getAllFeedback } = require('../controllers/feedback.controller');

// Admin only: view all feedback
router.get('/', authenticate, requireRole('ADMIN'), getAllFeedback);

module.exports = router;
