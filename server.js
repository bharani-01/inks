require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const seedAdmin = require('./utils/seedAdmin');
const { startAutoCleanupJob } = require('./services/autoCleanup.service');
const securityGuard = require('./middleware/securityGuard');

const authRoutes = require('./routes/auth.routes');
const userRoutes = require('./routes/user.routes');
const documentRoutes = require('./routes/document.routes');
const settingsRoutes = require('./routes/settings.routes');
const orderRoutes = require('./routes/order.routes');
const couponRoutes = require('./routes/coupon.routes');
const notificationRoutes = require('./routes/notification.routes');
const scanRoutes = require('./routes/scan.routes');
const feedbackRoutes = require('./routes/feedback.routes');
const walletRoutes = require('./routes/wallet.routes');
const auditRoutes = require('./routes/audit.routes');
const analyticsRoutes = require('./routes/analytics.routes');
const batchRoutes = require('./routes/batch.routes');
const unsubscribeRoutes = require('./routes/unsubscribe.routes');
const { sendBroadcast, listBroadcasts } = require('./controllers/broadcast.controller');
const auditLogger = require('./middleware/auditLogger');
const { adminListDocuments } = require('./controllers/document.controller');
const authenticate = require('./middleware/auth');
const requireRole = require('./middleware/roleCheck');

const app = express();
const PORT = process.env.PORT || 3000;

// Ensure uploads directory exists with validated absolute path
const uploadsDir = path.normalize(path.resolve(__dirname, 'uploads'));
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configured CORS with origin verification (no unrestricted wildcards)
const configuredOrigins = [
  process.env.APP_URL,
  process.env.CLIENT_URL,
  'http://localhost:3000',
  'http://localhost:5173',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:5173',
  'https://inks.trackifyapp.co.in',
  'https://mail.trackifyapp.co.in',
  'https://trackifyapp.co.in',
].filter(Boolean);

const corsOptions = {
  origin: (origin, callback) => {
    // Allow non-browser requests (same-origin, curl, server-to-server)
    if (!origin) return callback(null, true);
    const cleanOrigin = origin.replace(/\/$/, '');
    if (
      configuredOrigins.some((allowed) => allowed === cleanOrigin || allowed === '*') ||
      cleanOrigin.endsWith('.trackifyapp.co.in') ||
      cleanOrigin === 'https://trackifyapp.co.in'
    ) {
      return callback(null, true);
    }
    // In development allow localhost ports dynamically
    if (process.env.NODE_ENV !== 'production' && /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(cleanOrigin)) {
      return callback(null, true);
    }
    return callback(new Error('Cross-Origin Request Blocked by Security Policy'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
};

app.use(cors(corsOptions));
app.use(express.json({ limit: '500mb' }));
app.use(express.urlencoded({ limit: '500mb', extended: true }));

// Global cyber forensic audit logger (records every request, geo-location, user-agent, threat analysis)
app.use(auditLogger);

// Strict security guard: block .env, dotfiles, source code & backend directories
app.use(securityGuard);

// --- React SPA (client/dist) ---
const clientDist = path.normalize(path.resolve(__dirname, 'client', 'dist'));
const clientIndex = path.normalize(path.resolve(clientDist, 'index.html'));

// Serve the built React assets (hashed JS/CSS, icons)
app.use(express.static(clientDist, { index: false }));

// Sends the React shell
function sendSpa(res) {
  if (fs.existsSync(clientIndex)) {
    return res.sendFile(clientIndex, (err) => {
      if (err && !res.headersSent) {
        res.status(503).send('Frontend bundle is updating. Please refresh in a moment.');
      }
    });
  }
  return res.status(503).send('Frontend bundle not found. Please run "npm run build" in the server terminal.');
}

// Clean auth routes are owned by the React SPA
app.get('/login', (req, res) => sendSpa(res));
app.get('/register', (req, res) => sendSpa(res));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/coupons', couponRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/scan', scanRoutes);
app.use('/api/feedback', feedbackRoutes);
app.use('/api/wallet', walletRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/batch-orders', batchRoutes);
app.use('/api/unsubscribe', unsubscribeRoutes);

// Admin broadcast routes
app.post('/api/admin/broadcast', authenticate, requireRole('ADMIN'), sendBroadcast);
app.get('/api/admin/broadcasts', authenticate, requireRole('ADMIN'), listBroadcasts);

// Admin document listing (separate path for admin)
app.get('/api/admin/documents', authenticate, requireRole('ADMIN', 'PRINTER_ADMIN'), adminListDocuments);

app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ message: 'API endpoint not found' });
  }

  // /, /login, /register, /user/*, /admin/* and any client route → React SPA shell
  return sendSpa(res);
});

// Global error handler
app.use((err, req, res, next) => {
  if (err.message && err.message.includes('Security Policy')) {
    return res.status(403).json({ message: err.message });
  }
  console.error('Unhandled error:', err);
  res.status(500).json({ message: 'Internal server error' });
});

// Start server
async function start() {
  console.log('\n  Printa Server');
  console.log('  ─────────────────');

  // Seed default admin
  await seedAdmin();

  // Start background document auto-deletion service (30 mins after printing)
  startAutoCleanupJob();

  // Start server
  app.listen(PORT, () => {
    console.log(`\n  Server running on http://localhost:${PORT}`);
    console.log(`  API available at  http://localhost:${PORT}/api\n`);
  });
}

start().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
