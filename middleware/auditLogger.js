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

      // Extract user context from req.user or parse from token header
      let user = req.user || null;
      if (!user) {
        let token = null;
        const authHeader = req.headers['authorization'];
        if (authHeader && authHeader.startsWith('Bearer ')) {
          token = authHeader.split(' ')[1];
        } else if (req.query && req.query.token) {
          token = req.query.token;
        }

        if (token) {
          try {
            const jwt = require('jsonwebtoken');
            const decoded = jwt.decode(token);
            if (decoded && decoded.id) {
              user = {
                id: decoded.id,
                role: decoded.role,
                email: decoded.email || null,
                name: decoded.name || null,
              };
            }
          } catch {}
        }
      }

      // If still anonymous but request is a login attempt with email in body
      if (!user && req.body && req.body.email) {
        user = {
          email: String(req.body.email).toLowerCase().trim(),
          role: 'GUEST',
        };
      }

      recordAuditLog({
        requestId,
        method: req.method,
        route,
        fullUrl,
        statusCode: res.statusCode,
        latencyMs,
        user,
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
