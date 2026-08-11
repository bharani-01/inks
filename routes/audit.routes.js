const express = require('express');
const router = express.Router();
const auditController = require('../controllers/audit.controller');
const authenticate = require('../middleware/auth');
const requireRole = require('../middleware/roleCheck');

// All audit routes are strictly restricted to ADMIN role
router.use(authenticate);
router.use(requireRole('ADMIN'));

// Query & Infinite Scroll
router.get('/', auditController.getAuditLogs);

// Real-time Overview Stats
router.get('/stats', auditController.getAuditStats);

// Filtered Threats
router.get('/threats', auditController.getThreats);

// Real-time SSE Stream
router.get('/stream', auditController.streamAuditLogs);

// CSV Forensic Export
router.get('/export', auditController.exportAuditLogs);

module.exports = router;
