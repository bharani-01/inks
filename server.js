require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const seedAdmin = require('./utils/seedAdmin');

const authRoutes = require('./routes/auth.routes');
const userRoutes = require('./routes/user.routes');
const documentRoutes = require('./routes/document.routes');
const settingsRoutes = require('./routes/settings.routes');
const orderRoutes = require('./routes/order.routes');
const { adminListDocuments } = require('./controllers/document.controller');
const authenticate = require('./middleware/auth');
const requireRole = require('./middleware/roleCheck');

const app = express();
const PORT = process.env.PORT || 3000;

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const securityGuard = require('./middleware/securityGuard');

// Middleware
app.use(cors());
app.use(express.json({ limit: '500mb' }));
app.use(express.urlencoded({ limit: '500mb', extended: true }));

// Strict security guard: block .env, dotfiles, source code & backend directories
app.use(securityGuard);

// Serve static frontend files from /public (with clean .html extension resolving)
// --- React SPA (client/dist) + legacy static assets ---
const clientDist = path.join(__dirname, 'client', 'dist');
const clientIndex = path.join(clientDist, 'index.html');
const hasClientBuild = fs.existsSync(clientIndex);

// Serve the built React assets (hashed JS/CSS, icons). index:false so "/" is
// handled by the SPA fallback below rather than dist/index.html directly.
if (hasClientBuild) {
  app.use(express.static(clientDist, { index: false }));
} else {
  console.warn('  [warn] client/dist not found — run "npm run client:build" to serve the React frontend.');
}

// Serve legacy/public assets: admin HTML pages, CSS, JS, images, fonts.
// index:false so "/" does not resolve to the old public/index.html landing.
app.use(express.static(path.join(__dirname, 'public'), { index: false }));

// Sends the React shell (falls back to the legacy landing if no build exists yet).
function sendSpa(res) {
  return res.sendFile(hasClientBuild ? clientIndex : path.join(__dirname, 'public', 'index.html'));
}

// Clean auth routes are owned by the React SPA now.
app.get('/login', (req, res) => sendSpa(res));
app.get('/register', (req, res) => sendSpa(res));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/orders', orderRoutes);

// Admin document listing (separate path for admin)
app.get('/api/admin/documents', authenticate, requireRole('ADMIN'), adminListDocuments);

// Catch-all: admin stays as vanilla HTML; everything else is the React SPA.
app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ message: 'API endpoint not found' });
  }

  // Admin dashboard remains server-rendered HTML (not migrated to React).
  if (req.path === '/admin' || req.path.startsWith('/admin/')) {
    const pageName =
      req.path === '/admin' || req.path === '/admin/'
        ? 'dashboard'
        : req.path.replace('/admin/', '').split('?')[0];
    const adminPagePath = path.join(__dirname, 'public', 'admin', `${pageName}.html`);
    if (fs.existsSync(adminPagePath)) return res.sendFile(adminPagePath);
    return sendSpa(res);
  }

  // /, /login, /register, /user/*, and any unknown route → React SPA shell.
  return sendSpa(res);
});

// Global error handler
app.use((err, req, res, next) => {
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
  const { startAutoCleanupJob } = require('./services/autoCleanup.service');
  startAutoCleanupJob();

  app.listen(PORT, () => {
    console.log(`\n  Server running on http://localhost:${PORT}`);
    console.log(`  API available at  http://localhost:${PORT}/api\n`);
  });
}

start().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
