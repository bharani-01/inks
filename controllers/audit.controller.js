const prisma = require('../config/db');
const { registerSseClient } = require('../services/audit.service');

/**
 * Paginated / Infinite Scroll Audit Log Query
 */
async function getAuditLogs(req, res) {
  try {
    const {
      limit = '30',
      cursor,
      page = '1',
      severity,
      statusCode,
      statusCategory, // '2xx' | '4xx' | '5xx'
      action,
      userId,
      userEmail,
      ipAddress,
      deviceType,
      isBot,
      search,
      startDate,
      endDate,
    } = req.query;

    const take = Math.min(Math.max(parseInt(limit, 10) || 30, 1), 100);
    const where = {};

    // Severity Filter
    if (severity && ['INFO', 'WARN', 'ALERT', 'CRITICAL'].includes(severity.toUpperCase())) {
      where.severity = severity.toUpperCase();
    }

    // Status Code Filter
    if (statusCode) {
      const code = parseInt(statusCode, 10);
      if (!isNaN(code)) where.statusCode = code;
    } else if (statusCategory) {
      if (statusCategory === '2xx') where.statusCode = { gte: 200, lte: 299 };
      else if (statusCategory === '3xx') where.statusCode = { gte: 300, lte: 399 };
      else if (statusCategory === '4xx') where.statusCode = { gte: 400, lte: 499 };
      else if (statusCategory === '5xx') where.statusCode = { gte: 500, lte: 599 };
    }

    // Action Filter
    if (action) {
      where.action = action;
    }

    // User Filters
    if (userId) {
      where.userId = parseInt(userId, 10);
    }
    if (userEmail) {
      where.userEmail = { contains: userEmail, mode: 'insensitive' };
    }

    // IP Address Filter
    if (ipAddress) {
      where.ipAddress = { contains: ipAddress };
    }

    // Device / Bot Filters
    if (deviceType) {
      where.deviceType = deviceType.toLowerCase();
    }
    if (isBot !== undefined && isBot !== '') {
      where.isBot = isBot === 'true';
    }

    // Date Range
    if (startDate || endDate) {
      where.timestamp = {};
      if (startDate) where.timestamp.gte = new Date(startDate);
      if (endDate) where.timestamp.lte = new Date(endDate);
    }

    // Universal Text Search
    if (search && search.trim()) {
      const q = search.trim();
      where.OR = [
        { route: { contains: q, mode: 'insensitive' } },
        { fullUrl: { contains: q, mode: 'insensitive' } },
        { action: { contains: q, mode: 'insensitive' } },
        { userEmail: { contains: q, mode: 'insensitive' } },
        { ipAddress: { contains: q } },
        { requestId: { contains: q } },
        { geoCity: { contains: q, mode: 'insensitive' } },
        { geoCountry: { contains: q, mode: 'insensitive' } },
        { geoOrg: { contains: q, mode: 'insensitive' } },
      ];
    }

    // Cursor-based pagination (ideal for infinite scroll) or Offset-based
    let logs = [];
    if (cursor) {
      const cursorId = parseInt(cursor, 10);
      logs = await prisma.auditLog.findMany({
        take: take + 1,
        skip: 1,
        cursor: { id: cursorId },
        where,
        orderBy: { id: 'desc' },
      });
    } else {
      const pageNum = parseInt(page, 10) || 1;
      const skip = (pageNum - 1) * take;
      logs = await prisma.auditLog.findMany({
        take: take + 1,
        skip,
        where,
        orderBy: { id: 'desc' },
      });
    }

    let hasMore = false;
    let nextCursor = null;
    if (logs.length > take) {
      hasMore = true;
      logs.pop(); // Remove the lookahead item
      nextCursor = logs[logs.length - 1]?.id || null;
    } else if (logs.length > 0) {
      nextCursor = logs[logs.length - 1]?.id || null;
    }

    // Get approximate total count
    const totalCount = await prisma.auditLog.count({ where });

    return res.json({
      logs,
      hasMore,
      nextCursor,
      totalCount,
    });
  } catch (err) {
    console.error('getAuditLogs error:', err);
    return res.status(500).json({ message: 'Failed to retrieve audit logs' });
  }
}

/**
 * Real-time Aggregate Security & System Stats
 */
async function getAuditStats(req, res) {
  try {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const past24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const [
      totalToday,
      total24h,
      threatsCount,
      errors4xx,
      errors5xx,
      botCount,
      severityCounts,
    ] = await Promise.all([
      prisma.auditLog.count({ where: { timestamp: { gte: startOfToday } } }),
      prisma.auditLog.count({ where: { timestamp: { gte: past24h } } }),
      prisma.auditLog.count({
        where: {
          timestamp: { gte: past24h },
          severity: { in: ['WARN', 'ALERT', 'CRITICAL'] },
        },
      }),
      prisma.auditLog.count({
        where: {
          timestamp: { gte: past24h },
          statusCode: { gte: 400, lte: 499 },
        },
      }),
      prisma.auditLog.count({
        where: {
          timestamp: { gte: past24h },
          statusCode: { gte: 500, lte: 599 },
        },
      }),
      prisma.auditLog.count({
        where: {
          timestamp: { gte: past24h },
          isBot: true,
        },
      }),
      prisma.auditLog.groupBy({
        by: ['severity'],
        where: { timestamp: { gte: past24h } },
        _count: { severity: true },
      }),
    ]);

    // Format severity counts
    const severityMap = { INFO: 0, WARN: 0, ALERT: 0, CRITICAL: 0 };
    severityCounts.forEach((item) => {
      severityMap[item.severity] = item._count.severity;
    });

    const botPercentage = total24h > 0 ? ((botCount / total24h) * 100).toFixed(1) : '0.0';
    const errorRate = total24h > 0 ? (((errors4xx + errors5xx) / total24h) * 100).toFixed(1) : '0.0';

    return res.json({
      totalToday,
      total24h,
      threatsCount,
      errors4xx,
      errors5xx,
      botCount,
      botPercentage: Number(botPercentage),
      errorRate: Number(errorRate),
      severityBreakdown: severityMap,
    });
  } catch (err) {
    console.error('getAuditStats error:', err);
    return res.status(500).json({ message: 'Failed to retrieve audit statistics' });
  }
}

/**
 * Filtered Security Threats View
 */
async function getThreats(req, res) {
  try {
    const { limit = '50' } = req.query;
    const take = Math.min(parseInt(limit, 10) || 50, 200);

    const threats = await prisma.auditLog.findMany({
      take,
      where: {
        OR: [
          { severity: { in: ['ALERT', 'CRITICAL'] } },
          { threatFlags: { isEmpty: false } },
        ],
      },
      orderBy: { id: 'desc' },
    });

    return res.json({ threats });
  } catch (err) {
    console.error('getThreats error:', err);
    return res.status(500).json({ message: 'Failed to retrieve threat logs' });
  }
}

/**
 * Stream live SSE audit events
 */
function streamAuditLogs(req, res) {
  registerSseClient(req, res);
}

/**
 * Export filtered audit logs as CSV
 */
async function exportAuditLogs(req, res) {
  try {
    const {
      severity,
      statusCode,
      action,
      search,
      startDate,
      endDate,
    } = req.query;

    const where = {};
    if (severity) where.severity = severity.toUpperCase();
    if (statusCode) where.statusCode = parseInt(statusCode, 10);
    if (action) where.action = action;
    if (startDate || endDate) {
      where.timestamp = {};
      if (startDate) where.timestamp.gte = new Date(startDate);
      if (endDate) where.timestamp.lte = new Date(endDate);
    }
    if (search) {
      const q = search.trim();
      where.OR = [
        { route: { contains: q, mode: 'insensitive' } },
        { action: { contains: q, mode: 'insensitive' } },
        { userEmail: { contains: q, mode: 'insensitive' } },
        { ipAddress: { contains: q } },
      ];
    }

    const logs = await prisma.auditLog.findMany({
      take: 5000, // Export limit
      where,
      orderBy: { id: 'desc' },
    });

    // CSV Headers
    const headers = [
      'ID',
      'Timestamp (UTC)',
      'Request ID',
      'Severity',
      'Method',
      'Status',
      'Latency (ms)',
      'Action',
      'Route',
      'User Email',
      'User Role',
      'Client IP',
      'Country',
      'City',
      'ISP / Org',
      'Device Type',
      'OS',
      'Browser',
      'Is Bot',
      'Threat Flags',
      'Body Hash (SHA-256)',
    ];

    const escapeCsv = (val) => {
      if (val === null || val === undefined) return '""';
      const str = String(val).replace(/"/g, '""');
      return `"${str}"`;
    };

    const csvRows = [headers.join(',')];

    for (const log of logs) {
      const row = [
        log.id,
        log.timestamp.toISOString(),
        log.requestId,
        log.severity,
        log.method,
        log.statusCode,
        log.latencyMs ?? '',
        log.action,
        log.route,
        log.userEmail ?? '',
        log.userRole ?? '',
        log.ipAddress,
        log.geoCountry ?? '',
        log.geoCity ?? '',
        log.geoOrg ?? '',
        log.deviceType ?? '',
        log.deviceOs ?? '',
        log.deviceBrowser ?? '',
        log.isBot ? 'YES' : 'NO',
        (log.threatFlags || []).join('; '),
        log.requestBodyHash ?? '',
      ];
      csvRows.push(row.map(escapeCsv).join(','));
    }

    const csvContent = csvRows.join('\r\n');
    const filename = `inks_audit_ledger_${new Date().toISOString().slice(0, 10)}.csv`;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.send(csvContent);
  } catch (err) {
    console.error('exportAuditLogs error:', err);
    return res.status(500).json({ message: 'Failed to export audit logs' });
  }
}

module.exports = {
  getAuditLogs,
  getAuditStats,
  getThreats,
  streamAuditLogs,
  exportAuditLogs,
};
