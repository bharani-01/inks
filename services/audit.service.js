const crypto = require('crypto');
const { UAParser } = require('ua-parser-js');
const prisma = require('../config/db');

// In-memory Geo Cache: IP -> { geoData, cachedAt }
const geoCache = new Map();
const GEO_CACHE_TTL = 1000 * 60 * 60 * 24; // 24 hours

// In-memory User Profile Cache: userId -> { id, email, role, name }
const userProfileCache = new Map();

// In-memory Threat Tracking: IP -> { failedLogins: [], requestTimestamps: [] }
const threatTracker = new Map();

// Active Admin SSE Clients for live real-time audit streaming
const sseClients = new Set();

// Clean up tracker periodically every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [ip, data] of threatTracker.entries()) {
    data.failedLogins = data.failedLogins.filter((t) => now - t < 60000);
    data.requestTimestamps = data.requestTimestamps.filter((t) => now - t < 10000);
    if (data.failedLogins.length === 0 && data.requestTimestamps.length === 0) {
      threatTracker.delete(ip);
    }
  }
}, 5 * 60 * 1000);

/**
 * Extract clean client IP address handling proxies, load balancers, and Cloudflare
 */
function extractClientIp(req) {
  const cfIp = req.headers['cf-connecting-ip'];
  if (cfIp) return cfIp.trim();

  const xRealIp = req.headers['x-real-ip'];
  if (xRealIp) return xRealIp.trim();

  const xForwarded = req.headers['x-forwarded-for'];
  if (xForwarded) {
    const parts = xForwarded.split(',');
    const first = parts[0]?.trim();
    if (first) return first;
  }

  const rawIp = req.ip || req.socket?.remoteAddress || '127.0.0.1';
  return rawIp.replace(/^::ffff:/, '');
}

/**
 * Check if an IP address is a private/local network address
 */
function isPrivateOrLocalIp(ip) {
  if (!ip) return true;
  if (ip === '127.0.0.1' || ip === '::1' || ip === 'localhost') return true;
  if (ip.startsWith('10.') || ip.startsWith('192.168.')) return true;
  if (/^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(ip)) return true;
  if (ip.startsWith('fe80::') || ip.startsWith('fc00::')) return true;
  return false;
}

/**
 * Multi-Provider Geo-Location Lookup with parallel race & fallback
 */
async function fetchGeoLocation(ip) {
  if (!ip || isPrivateOrLocalIp(ip)) {
    return {
      geoCountry: 'Local Network',
      geoCountryCode: 'LAN',
      geoRegion: 'Internal / Development',
      geoCity: 'Localhost',
      geoLat: null,
      geoLon: null,
      geoOrg: 'Private Network',
      geoAsn: 'AS0',
      geoTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
      geoProvider: 'Internal',
      geoIsProxy: false,
      geoIsTor: false,
      geoIsHosting: false,
    };
  }

  // Check in-memory cache first
  const cached = geoCache.get(ip);
  if (cached && Date.now() - cached.cachedAt < GEO_CACHE_TTL) {
    return cached.geoData;
  }

  // Multi-provider cascade with timeout
  const timeoutMs = 1200;

  // Provider 1: ip-api.com
  const queryIpApi = async () => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(
        `http://ip-api.com/json/${ip}?fields=status,message,country,countryCode,regionName,city,lat,lon,timezone,isp,org,as,proxy,hosting`,
        { signal: controller.signal }
      );
      clearTimeout(timer);
      if (!res.ok) throw new Error('ip-api error');
      const data = await res.json();
      if (data.status !== 'success') throw new Error(data.message || 'ip-api failure');
      return {
        geoCountry: data.country || 'Unknown',
        geoCountryCode: data.countryCode || 'UN',
        geoRegion: data.regionName || '',
        geoCity: data.city || '',
        geoLat: typeof data.lat === 'number' ? data.lat : null,
        geoLon: typeof data.lon === 'number' ? data.lon : null,
        geoOrg: data.org || data.isp || '',
        geoAsn: data.as || '',
        geoTimezone: data.timezone || '',
        geoProvider: 'ip-api.com',
        geoIsProxy: Boolean(data.proxy),
        geoIsTor: false,
        geoIsHosting: Boolean(data.hosting),
      };
    } catch {
      clearTimeout(timer);
      throw new Error('ip-api failed');
    }
  };

  // Provider 2: ipwho.is
  const queryIpWhoIs = async () => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(`https://ipwho.is/${ip}`, { signal: controller.signal });
      clearTimeout(timer);
      if (!res.ok) throw new Error('ipwhois error');
      const data = await res.json();
      if (!data.success) throw new Error(data.message || 'ipwhois failure');
      return {
        geoCountry: data.country || 'Unknown',
        geoCountryCode: data.country_code || 'UN',
        geoRegion: data.region || '',
        geoCity: data.city || '',
        geoLat: typeof data.latitude === 'number' ? data.latitude : null,
        geoLon: typeof data.longitude === 'number' ? data.longitude : null,
        geoOrg: data.connection?.org || data.connection?.isp || '',
        geoAsn: data.connection?.asn ? `AS${data.connection.asn}` : '',
        geoTimezone: data.timezone?.id || '',
        geoProvider: 'ipwho.is',
        geoIsProxy: Boolean(data.security?.proxy || data.security?.vpn),
        geoIsTor: Boolean(data.security?.tor),
        geoIsHosting: Boolean(data.security?.hosting),
      };
    } catch {
      clearTimeout(timer);
      throw new Error('ipwhois failed');
    }
  };

  // Provider 3: ipapi.co
  const queryIpApiCo = async () => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(`https://ipapi.co/${ip}/json/`, { signal: controller.signal });
      clearTimeout(timer);
      if (!res.ok) throw new Error('ipapi.co error');
      const data = await res.json();
      if (data.error) throw new Error(data.reason || 'ipapi.co failure');
      return {
        geoCountry: data.country_name || 'Unknown',
        geoCountryCode: data.country_code || 'UN',
        geoRegion: data.region || '',
        geoCity: data.city || '',
        geoLat: typeof data.latitude === 'number' ? data.latitude : null,
        geoLon: typeof data.longitude === 'number' ? data.longitude : null,
        geoOrg: data.org || '',
        geoAsn: data.asn || '',
        geoTimezone: data.timezone || '',
        geoProvider: 'ipapi.co',
        geoIsProxy: false,
        geoIsTor: false,
        geoIsHosting: false,
      };
    } catch {
      clearTimeout(timer);
      throw new Error('ipapi.co failed');
    }
  };

  // Run in order with fallback
  let geoResult = null;
  try {
    geoResult = await queryIpApi();
  } catch {
    try {
      geoResult = await queryIpWhoIs();
    } catch {
      try {
        geoResult = await queryIpApiCo();
      } catch {
        geoResult = {
          geoCountry: 'Unknown Location',
          geoCountryCode: 'UN',
          geoRegion: '',
          geoCity: '',
          geoLat: null,
          geoLon: null,
          geoOrg: '',
          geoAsn: '',
          geoTimezone: '',
          geoProvider: 'Lookup Failed',
          geoIsProxy: false,
          geoIsTor: false,
          geoIsHosting: false,
        };
      }
    }
  }

  // Cache successful result
  geoCache.set(ip, { geoData: geoResult, cachedAt: Date.now() });
  return geoResult;
}

/**
 * Parse User-Agent using ua-parser-js + Bot Heuristics
 */
function parseUserAgent(uaString) {
  if (!uaString || typeof uaString !== 'string') {
    return {
      deviceType: 'unknown',
      deviceOs: 'Unknown OS',
      deviceBrowser: 'Unknown Browser',
      deviceBrowserVer: '',
      isBot: false,
      botName: null,
    };
  }

  const parser = new UAParser(uaString);
  const result = parser.getResult();

  const rawUa = uaString.toLowerCase();

  // Bot & Crawler Detection
  const botKeywords = [
    'bot',
    'crawler',
    'spider',
    'slurp',
    'curl',
    'wget',
    'postman',
    'insomnia',
    'axios',
    'python',
    'nmap',
    'sqlmap',
    'nikto',
    'gobuster',
    'headlesschrome',
    'puppeteer',
    'playwright',
    'selenium',
    'ahrefs',
    'semrush',
    'googlebot',
    'bingbot',
    'yandex',
  ];

  let isBot = false;
  let botName = null;

  for (const b of botKeywords) {
    if (rawUa.includes(b)) {
      isBot = true;
      botName = b.toUpperCase();
      break;
    }
  }

  // Device Classification
  let deviceType = result.device?.type || 'desktop';
  if (isBot) {
    deviceType = 'bot';
  } else if (!result.device?.type) {
    if (rawUa.includes('mobile') || rawUa.includes('android') || rawUa.includes('iphone')) {
      deviceType = 'mobile';
    } else if (rawUa.includes('ipad') || rawUa.includes('tablet')) {
      deviceType = 'tablet';
    } else {
      deviceType = 'desktop';
    }
  }

  const os = result.os?.name ? `${result.os.name}${result.os.version ? ' ' + result.os.version : ''}` : 'Unknown OS';
  const browser = result.browser?.name || 'Unknown Browser';
  const browserVer = result.browser?.version || '';

  return {
    deviceType,
    deviceOs: os,
    deviceBrowser: browser,
    deviceBrowserVer: browserVer,
    isBot,
    botName,
  };
}

/**
 * Threat Analysis & Cyber Forensics Engine
 */
function analyzeThreats(req, res, ip, fullUrl, bodyHash) {
  const flags = [];
  const now = Date.now();
  const rawUrl = (fullUrl || '').toLowerCase();
  const statusCode = res.statusCode;

  // Retrieve or create tracker for IP
  let tracker = threatTracker.get(ip);
  if (!tracker) {
    tracker = { failedLogins: [], requestTimestamps: [] };
    threatTracker.set(ip, tracker);
  }

  tracker.requestTimestamps.push(now);
  tracker.requestTimestamps = tracker.requestTimestamps.filter((t) => now - t < 10000);

  // 1. Rapid Fire / Rate Burst (>35 requests within 10 seconds)
  if (tracker.requestTimestamps.length > 35) {
    flags.push('RAPID_FIRE');
  }

  // 2. Authentication Failures & Brute Force
  if (statusCode === 401 && (rawUrl.includes('/auth') || rawUrl.includes('/login') || rawUrl.includes('/verify-otp'))) {
    tracker.failedLogins.push(now);
  }
  tracker.failedLogins = tracker.failedLogins.filter((t) => now - t < 60000);

  if (tracker.failedLogins.length >= 4) {
    flags.push('BRUTE_FORCE');
  }

  // 3. Path Traversal & File Probing
  if (
    rawUrl.includes('..') ||
    rawUrl.includes('%2e%2e') ||
    rawUrl.includes('/.env') ||
    rawUrl.includes('/.git') ||
    rawUrl.includes('/wp-') ||
    rawUrl.includes('/phpmyadmin') ||
    rawUrl.includes('/etc/passwd')
  ) {
    flags.push('PATH_TRAVERSAL');
  }

  // 4. SQL Injection Patterns
  const sqliPatterns = [
    'union%20select',
    'union select',
    ' or 1=1',
    '%27%20or%201=1',
    'drop%20table',
    'exec(',
    '--',
    '/*',
    ';--',
  ];
  if (sqliPatterns.some((pattern) => rawUrl.includes(pattern))) {
    flags.push('SQL_INJECTION');
  }

  // 5. Forbidden Access Probe (403 on protected/system endpoint)
  if (statusCode === 403) {
    flags.push('FORBIDDEN_ACCESS');
  }

  // 6. Suspicious / Scanner Tools
  const ua = (req.headers['user-agent'] || '').toLowerCase();
  if (!ua || ua.includes('sqlmap') || ua.includes('nikto') || ua.includes('nmap') || ua.includes('gobuster')) {
    flags.push('SUSPICIOUS_UA');
  }

  // Determine Severity Level
  let severity = 'INFO';
  if (flags.includes('SQL_INJECTION') || flags.includes('PATH_TRAVERSAL')) {
    severity = 'CRITICAL';
  } else if (flags.includes('BRUTE_FORCE') || flags.includes('FORBIDDEN_ACCESS') || flags.includes('SUSPICIOUS_UA')) {
    severity = 'ALERT';
  } else if (statusCode >= 400 || flags.includes('RAPID_FIRE')) {
    severity = 'WARN';
  }

  return { flags, severity };
}

/**
 * Deduce a human-readable Action string from the route and method
 */
function classifyAction(req, res) {
  const method = req.method.toUpperCase();
  const path = req.path || '';

  if (path.startsWith('/api/auth/login')) return 'USER_LOGIN';
  if (path.startsWith('/api/auth/register')) return 'USER_REGISTER';
  if (path.startsWith('/api/auth/verify-otp')) return 'OTP_VERIFY';
  if (path.startsWith('/api/auth/forgot-password')) return 'FORGOT_PASSWORD';
  if (path.startsWith('/api/auth/reset-password')) return 'PASSWORD_RESET';
  if (path.startsWith('/api/auth/me')) return 'AUTH_CHECK';

  if (path.startsWith('/api/wallet/pay')) return 'WALLET_ORDER_PAY';
  if (path.startsWith('/api/wallet/admin/topup')) return 'ADMIN_WALLET_TOPUP';
  if (path.startsWith('/api/wallet/admin')) return 'ADMIN_WALLET_VIEW';
  if (path.startsWith('/api/wallet')) return 'USER_WALLET_VIEW';

  if (path.startsWith('/api/orders') && method === 'POST') return 'ORDER_CREATE';
  if (path.startsWith('/api/orders') && method === 'GET') return 'ORDER_LIST';
  if (path.startsWith('/api/documents') && method === 'POST') return 'DOCUMENT_UPLOAD';
  if (path.startsWith('/api/documents') && method === 'GET') return 'DOCUMENT_VIEW';
  if (path.startsWith('/api/scan')) return 'QR_SCAN_VERIFY';
  if (path.startsWith('/api/users')) return 'USER_MANAGEMENT';
  if (path.startsWith('/api/coupons')) return 'COUPON_OPERATION';
  if (path.startsWith('/api/feedback')) return 'FEEDBACK_SUBMIT';
  if (path.startsWith('/api/settings')) return 'SETTINGS_CHANGE';

  if (path.startsWith('/api/audit')) return 'AUDIT_LOG_VIEW';

  return `${method}_${path.replace(/^\/api\//, '').replace(/\//g, '_').toUpperCase()}`;
}

/**
 * Record an audit log event asynchronously (zero-latency, non-blocking)
 */
async function recordAuditLog(logPayload) {
  // Use setImmediate to guarantee it never blocks the current event loop turn
  setImmediate(async () => {
    try {
      const {
        requestId,
        method,
        route,
        fullUrl,
        statusCode,
        latencyMs,
        user,
        req,
        res,
      } = logPayload;

      const ipAddress = extractClientIp(req);
      const ipForwarded = req.headers['x-forwarded-for'] || null;
      const userAgentString = req.headers['user-agent'] || null;

      // Extract geo location
      const geoInfo = await fetchGeoLocation(ipAddress);

      // Parse UA forensics
      const uaInfo = parseUserAgent(userAgentString);

      // Request Body Hash (SHA-256)
      let requestBodyHash = null;
      if (req.body && Object.keys(req.body).length > 0) {
        // Strip sensitive fields before hashing (or hash full body safely)
        const safeBody = { ...req.body };
        if (safeBody.password) safeBody.password = '[REDACTED]';
        if (safeBody.passwordHash) safeBody.passwordHash = '[REDACTED]';
        requestBodyHash = crypto.createHash('sha256').update(JSON.stringify(safeBody)).digest('hex');
      }

      // Session Fingerprint
      const sessionString = `${ipAddress}|${userAgentString || ''}|${user?.id || 'ANON'}`;
      const sessionFingerprint = crypto.createHash('sha256').update(sessionString).digest('hex');

      // Threat Analysis
      const { flags: threatFlags, severity } = analyzeThreats(req, res, ipAddress, fullUrl, requestBodyHash);

      // Action classification
      const action = classifyAction(req, res);

      const authMethod = req.headers.authorization ? 'JWT_BEARER' : 'ANONYMOUS';

      // Resolve user email and role from cache or database if userId is present
      let resolvedUserId = user?.id || null;
      let resolvedUserEmail = user?.email || null;
      let resolvedUserRole = user?.role || null;

      if (resolvedUserId && !resolvedUserEmail) {
        let cachedUser = userProfileCache.get(resolvedUserId);
        if (!cachedUser) {
          try {
            const dbUser = await prisma.user.findUnique({
              where: { id: resolvedUserId },
              select: { id: true, email: true, role: true, name: true },
            });
            if (dbUser) {
              cachedUser = dbUser;
              userProfileCache.set(resolvedUserId, cachedUser);
            }
          } catch {}
        }
        if (cachedUser) {
          resolvedUserEmail = cachedUser.email;
          resolvedUserRole = cachedUser.role;
        }
      }

      // Insert into PostgreSQL database
      const createdLog = await prisma.auditLog.create({
        data: {
          requestId,
          timestamp: new Date(),
          latencyMs,
          method,
          route,
          fullUrl: fullUrl.slice(0, 2000),
          statusCode,

          userId: resolvedUserId,
          userEmail: resolvedUserEmail,
          userRole: resolvedUserRole,

          ipAddress,
          ipForwarded: ipForwarded ? ipForwarded.slice(0, 500) : null,

          geoCountry: geoInfo.geoCountry,
          geoCountryCode: geoInfo.geoCountryCode,
          geoRegion: geoInfo.geoRegion,
          geoCity: geoInfo.geoCity,
          geoLat: geoInfo.geoLat,
          geoLon: geoInfo.geoLon,
          geoOrg: geoInfo.geoOrg,
          geoAsn: geoInfo.geoAsn,
          geoTimezone: geoInfo.geoTimezone,
          geoProvider: geoInfo.geoProvider,
          geoIsProxy: geoInfo.geoIsProxy,
          geoIsTor: geoInfo.geoIsTor,
          geoIsHosting: geoInfo.geoIsHosting,

          userAgent: userAgentString,
          deviceType: uaInfo.deviceType,
          deviceOs: uaInfo.deviceOs,
          deviceBrowser: uaInfo.deviceBrowser,
          deviceBrowserVer: uaInfo.deviceBrowserVer,
          isBot: uaInfo.isBot,
          botName: uaInfo.botName,

          action,
          severity,
          threatFlags,
          requestBodyHash,
          referer: req.headers['referer'] ? req.headers['referer'].slice(0, 2000) : null,
          origin: req.headers['origin'] ? req.headers['origin'].slice(0, 500) : null,
          acceptLang: req.headers['accept-language'] ? req.headers['accept-language'].slice(0, 200) : null,
          xRequestedWith: req.headers['x-requested-with'] ? req.headers['x-requested-with'].slice(0, 100) : null,
          contentType: req.headers['content-type'] ? req.headers['content-type'].slice(0, 200) : null,

          authMethod,
          sessionFingerprint,
        },
      });

      // Broadcast live to all connected Admin SSE sessions
      broadcastToAdminSse(createdLog);
    } catch (err) {
      console.error('[AuditService] Failed to record audit log:', err.message);
    }
  });
}

/**
 * Broadcast an audit event to all connected admin SSE clients
 */
function broadcastToAdminSse(logEntry) {
  if (sseClients.size === 0) return;
  const payload = `event: audit_log\ndata: ${JSON.stringify(logEntry)}\n\n`;
  for (const client of sseClients) {
    try {
      client.res.write(payload);
    } catch (err) {
      sseClients.delete(client);
    }
  }
}

/**
 * Register an admin SSE client
 */
function registerSseClient(req, res) {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders?.();

  const client = { req, res, id: Date.now() };
  sseClients.add(client);

  // Send initial welcome/connected event
  res.write(`event: connected\ndata: ${JSON.stringify({ connected: true, clients: sseClients.size })}\n\n`);

  // Heartbeat ping every 15 seconds to keep connection alive through proxies
  const heartbeat = setInterval(() => {
    try {
      res.write(': ping\n\n');
    } catch {
      clearInterval(heartbeat);
      sseClients.delete(client);
    }
  }, 15000);

  req.on('close', () => {
    clearInterval(heartbeat);
    sseClients.delete(client);
  });
}

module.exports = {
  recordAuditLog,
  registerSseClient,
  extractClientIp,
  fetchGeoLocation,
  parseUserAgent,
};
