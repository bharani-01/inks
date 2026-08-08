const express = require('express');
const router = express.Router();
const authenticate = require('../middleware/auth');
const requireRole = require('../middleware/roleCheck');
const { getPricingSettings, updatePricingSettings } = require('../controllers/settings.controller');

// Public/Auth pricing read
router.get('/pricing', getPricingSettings);

// Admin pricing update
router.put('/pricing', authenticate, requireRole('ADMIN'), updatePricingSettings);

module.exports = router;
