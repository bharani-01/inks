const prisma = require('../config/db');
const os = require('os');

const AGENT_ROLES = ['PRINTER_AGENT', 'PRINTER_ADMIN', 'ADMIN'];

// ─── GET /api/agent/pending ─────────────────────────────────────────────────
/**
 * Returns lightweight list of orders that are:
 *   - paymentStatus = PAID
 *   - orderStatus = RECEIVED
 * Oldest first so agents print in FIFO order.
 */
async function getPendingOrders(req, res) {
  try {
    const page = req.query.page ? Math.max(1, parseInt(req.query.page)) : null;
    const limit = req.query.limit ? Math.min(200, Math.max(1, parseInt(req.query.limit))) : null;

    const where = {
      paymentStatus: 'PAID',
      orderStatus: { in: ['RECEIVED', 'PROCESSING'] },
    };

    const findOptions = {
      where,
      orderBy: { id: 'desc' },
      select: {
        id: true,
        orderNumber: true,
        colorMode: true,
        paperSize: true,
        sides: true,
        orientation: true,
        copies: true,
        pageRange: true,
        binding: true,
        instructions: true,
        totalPages: true,
        totalAmount: true,
        createdAt: true,
        user: {
          select: { id: true, name: true, email: true },
        },
        document: {
          select: { id: true, originalName: true, fileName: true, mimeType: true, fileSize: true },
        },
      },
    };

    if (page && limit) {
      findOptions.skip = (page - 1) * limit;
      findOptions.take = limit;
    }

    const [orders, count] = await Promise.all([
      prisma.order.findMany(findOptions),
      prisma.order.count({ where }),
    ]);

    res.json({ orders, count, total: count });
  } catch (err) {
    console.error('AgentPendingOrders error:', err);
    res.status(500).json({ message: 'Failed to fetch pending orders' });
  }
}

// ─── POST /api/agent/heartbeat ──────────────────────────────────────────────
/**
 * Agent sends alive ping + metadata every 30s.
 * Also returns any pending unacknowledged commands for this agent.
 */
async function heartbeat(req, res) {
  try {
    const {
      agentVersion = '1.0.0',
      hostname = 'unknown',
      osName = 'unknown',
      printerName = null,
      autoMode = false,
      pollInterval = 10,
      jobsPrinted = 0,
      jobsFailed = 0,
    } = req.body;

    const ipAddress =
      req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
      req.socket?.remoteAddress ||
      null;

    // Upsert the agent session
    await prisma.agentSession.upsert({
      where: { userId: req.user.id },
      update: {
        agentVersion,
        hostname,
        os: osName,
        printerName,
        ipAddress,
        isOnline: true,
        isPaused: false,
        autoMode,
        pollInterval,
        jobsPrinted,
        jobsFailed,
        lastHeartbeat: new Date(),
      },
      create: {
        userId: req.user.id,
        agentVersion,
        hostname,
        os: osName,
        printerName,
        ipAddress,
        isOnline: true,
        isPaused: false,
        autoMode,
        pollInterval,
        jobsPrinted,
        jobsFailed,
      },
    });

    // Fetch pending unacknowledged commands for this agent user
    const commands = await prisma.agentCommand.findMany({
      where: { userId: req.user.id, isAcked: false },
      orderBy: { createdAt: 'asc' },
      select: { id: true, commandType: true, payload: true, createdAt: true },
    });

    res.json({ ok: true, commands });
  } catch (err) {
    console.error('AgentHeartbeat error:', err);
    res.status(500).json({ message: 'Heartbeat failed' });
  }
}

// ─── POST /api/agent/log ────────────────────────────────────────────────────
/**
 * Agent posts activity log entries to Supabase.
 */
async function logActivity(req, res) {
  try {
    const {
      action,
      orderId = null,
      orderNumber = null,
      details = null,
      severity = 'INFO',
    } = req.body;

    if (!action) return res.status(400).json({ message: 'action is required' });

    await prisma.agentLog.create({
      data: {
        userId: req.user.id,
        action: String(action).substring(0, 50),
        orderId: orderId ? parseInt(orderId) : null,
        orderNumber: orderNumber ? String(orderNumber).substring(0, 50) : null,
        details: details ? (typeof details === 'object' ? JSON.stringify(details) : String(details)) : null,
        severity: ['INFO', 'WARN', 'ERROR'].includes(severity) ? severity : 'INFO',
      },
    });

    res.json({ ok: true });
  } catch (err) {
    console.error('AgentLogActivity error:', err);
    res.status(500).json({ message: 'Failed to log activity' });
  }
}

// ─── POST /api/agent/command/:id/ack ────────────────────────────────────────
/**
 * Agent acknowledges a command after executing it.
 */
async function ackCommand(req, res) {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ message: 'Invalid command ID' });

    await prisma.agentCommand.update({
      where: { id },
      data: { isAcked: true, ackedAt: new Date() },
    });

    res.json({ ok: true });
  } catch (err) {
    console.error('AgentAckCommand error:', err);
    res.status(500).json({ message: 'Failed to acknowledge command' });
  }
}

// ─── POST /api/agent/command ─────────────────────────────────────────────────
/**
 * Admin sends a remote command to a specific agent (identified by userId).
 */
async function sendCommand(req, res) {
  try {
    const { userId, commandType, payload = null } = req.body;

    const validCommands = [
      'PAUSE', 'RESUME', 'FORCE_POLL', 'CHANGE_PRINTER',
      'DISCONNECT', 'PRINT_ORDER', 'SET_AUTO_MODE', 'CHANGE_POLL_INTERVAL',
    ];

    if (!validCommands.includes(commandType)) {
      return res.status(400).json({ message: `Invalid command type: ${commandType}` });
    }
    if (!userId) return res.status(400).json({ message: 'userId is required' });

    // Verify target user is a PRINTER_AGENT
    const targetUser = await prisma.user.findUnique({
      where: { id: parseInt(userId) },
      select: { id: true, role: true, name: true },
    });
    if (!targetUser) return res.status(404).json({ message: 'Agent user not found' });
    if (targetUser.role !== 'PRINTER_AGENT') {
      return res.status(400).json({ message: 'Target user is not a PRINTER_AGENT' });
    }

    const command = await prisma.agentCommand.create({
      data: {
        userId: targetUser.id,
        commandType,
        payload: payload ? JSON.stringify(payload) : null,
        sentBy: req.user.id,
      },
    });

    res.json({ ok: true, command });
  } catch (err) {
    console.error('AgentSendCommand error:', err);
    res.status(500).json({ message: 'Failed to send command' });
  }
}

// ─── GET /api/agent/sessions ─────────────────────────────────────────────────
/**
 * Admin: List all agent sessions with online/offline status.
 * Auto-marks sessions offline if lastHeartbeat > 2 minutes ago.
 */
async function getAgentSessions(req, res) {
  try {
    // Mark stale sessions as offline (> 2 min since last heartbeat)
    const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);
    await prisma.agentSession.updateMany({
      where: { lastHeartbeat: { lt: twoMinutesAgo }, isOnline: true },
      data: { isOnline: false },
    });

    const sessions = await prisma.agentSession.findMany({
      orderBy: { lastHeartbeat: 'desc' },
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
    });

    res.json({ sessions });
  } catch (err) {
    console.error('GetAgentSessions error:', err);
    res.status(500).json({ message: 'Failed to fetch agent sessions' });
  }
}

// ─── GET /api/agent/logs ──────────────────────────────────────────────────────
/**
 * Admin: Paginated + filterable agent activity logs.
 */
async function getAgentLogs(req, res) {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 30));
    const userId = req.query.userId ? parseInt(req.query.userId) : undefined;
    const severity = req.query.severity || '';
    const action = req.query.action || '';
    const search = req.query.search || '';

    const where = {};
    if (userId) where.userId = userId;
    if (severity && ['INFO', 'WARN', 'ERROR'].includes(severity)) where.severity = severity;
    if (action) where.action = { contains: action, mode: 'insensitive' };
    if (search) {
      where.OR = [
        { orderNumber: { contains: search, mode: 'insensitive' } },
        { details: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [logs, total] = await Promise.all([
      prisma.agentLog.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
      }),
      prisma.agentLog.count({ where }),
    ]);

    res.json({
      logs,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (err) {
    console.error('GetAgentLogs error:', err);
    res.status(500).json({ message: 'Failed to fetch agent logs' });
  }
}

// ─── GET /api/agent/commands ──────────────────────────────────────────────────
/**
 * Admin: List sent commands with ack status.
 */
async function getAgentCommands(req, res) {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, parseInt(req.query.limit) || 20);
    const userId = req.query.userId ? parseInt(req.query.userId) : undefined;

    const where = {};
    if (userId) where.userId = userId;

    const [commands, total] = await Promise.all([
      prisma.agentCommand.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
      }),
      prisma.agentCommand.count({ where }),
    ]);

    res.json({
      commands,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (err) {
    console.error('GetAgentCommands error:', err);
    res.status(500).json({ message: 'Failed to fetch agent commands' });
  }
}

// ─── POST /api/agent/disconnect ───────────────────────────────────────────────
/**
 * Agent calls this on graceful logout/disconnect to mark session offline.
 */
async function agentDisconnect(req, res) {
  try {
    await prisma.agentSession.updateMany({
      where: { userId: req.user.id },
      data: { isOnline: false },
    });
    res.json({ ok: true });
  } catch (err) {
    console.error('AgentDisconnect error:', err);
    res.status(500).json({ message: 'Disconnect failed' });
  }
}

module.exports = {
  getPendingOrders,
  heartbeat,
  logActivity,
  ackCommand,
  sendCommand,
  getAgentSessions,
  getAgentLogs,
  getAgentCommands,
  agentDisconnect,
};
