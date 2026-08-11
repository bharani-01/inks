const { v4: uuidv4 } = require('uuid');
const { recordAuditLog } = require('../services/audit.service');

/**
 * Zero-Latency Audit Logger Middleware
 * Captures request & response forensics and commits to audit service asynchronously
 */
function auditLogger(req, res, next) {
  // Ignore static client assets like vite chunks, images, icons, and css
  const path = req.path || '';
  if (
    path.startsWith('/assets/') ||
    path.startsWith('/illustrations/') ||
    path.startsWith('/vite.svg') ||
    path.startsWith('/favicon.ico') ||
    path.endsWith('.js') ||
    path.endsWith('.css') ||
    path.endsWith('.png') ||
    path.endsWith('.jpg') ||
    path.endsWith('.svg') ||
    path.endsWith('.webp') ||
    path.endsWith('.map')
  ) {
    return next();
  }

  const requestId = uuidv4();
  req.requestId = requestId;
  res.setHeader('X-Request-Id', requestId);

  const startHrTime = process.hrtime.bigint();

  // Intercept finish event to capture response status and calculate latency
  res.on('finish', () => {
    try {
      const endHrTime = process.hrtime.bigint();
      const latencyMs = Number((endHrTime - startHrTime) / 1000000n);

      const route = req.route ? `${req.baseUrl || ''}${req.route.path}` : req.path;
      const fullUrl = req.originalUrl || req.url;

      recordAuditLog({
        requestId,
        method: req.method,
        route,
        fullUrl,
        statusCode: res.statusCode,
        latencyMs,
        user: req.user || null,
        req,
        res,
      });
    } catch (err) {
      console.error('[auditLogger] finish interceptor error:', err);
    }
  });

  next();
}

module.exports = auditLogger;
