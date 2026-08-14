const express = require('express');
const router = express.Router();
const authenticate = require('../middleware/auth');
const requireRole = require('../middleware/roleCheck');
const {
  getPendingOrders,
  heartbeat,
  logActivity,
  ackCommand,
  sendCommand,
  getAgentSessions,
  getAgentLogs,
  getAgentCommands,
  agentDisconnect,
} = require('../controllers/agent.controller');

const AGENT_ROLES = ['PRINTER_AGENT', 'PRINTER_ADMIN', 'ADMIN'];
const ADMIN_ROLES = ['ADMIN', 'PRINTER_ADMIN'];

// All agent routes require authentication
router.use(authenticate);

// ─── Agent-side endpoints (PRINTER_AGENT / ADMIN / PRINTER_ADMIN) ─────────────
router.get('/pending',        requireRole(...AGENT_ROLES), getPendingOrders);
router.post('/heartbeat',     requireRole(...AGENT_ROLES), heartbeat);
router.post('/log',           requireRole(...AGENT_ROLES), logActivity);
router.post('/disconnect',    requireRole(...AGENT_ROLES), agentDisconnect);
router.post('/command/:id/ack', requireRole(...AGENT_ROLES), ackCommand);

// ─── Admin-side endpoints (ADMIN / PRINTER_ADMIN only) ──────────────────────
router.get('/sessions',       requireRole(...ADMIN_ROLES), getAgentSessions);
router.get('/logs',           requireRole(...ADMIN_ROLES), getAgentLogs);
router.get('/commands',       requireRole(...ADMIN_ROLES), getAgentCommands);
router.post('/command',       requireRole(...ADMIN_ROLES), sendCommand);

module.exports = router;
