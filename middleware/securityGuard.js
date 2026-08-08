const path = require('path');

const FORBIDDEN_EXTENSIONS = [
  '.env',
  '.json',
  '.prisma',
  '.log',
  '.sql',
  '.md',
  '.yml',
  '.yaml',
  '.sh',
  '.bat',
  '.cmd',
  '.ps1',
  '.git',
  '.gitignore',
  '.lock',
];

const FORBIDDEN_PATHS = [
  '/controllers',
  '/routes',
  '/middleware',
  '/services',
  '/config',
  '/prisma',
  '/uploads',
  '/node_modules',
  '/utils',
  '/package.json',
  '/package-lock.json',
  '/server.js',
];

/**
 * Strict Security Guard Middleware
 * Blocks access to dotfiles, backend source code, configuration files, and restricted directories
 */
function securityGuard(req, res, next) {
  const reqPath = (req.path || '').toLowerCase();

  // 1. Block dotfiles (e.g., /.env, /.git, /.env.local)
  if (reqPath.includes('/.') || reqPath.startsWith('.')) {
    return res.status(403).json({ message: 'Access Denied: Restricted file' });
  }

  // 2. Block path traversal attempts
  if (reqPath.includes('..') || reqPath.includes('%2e%2e') || reqPath.includes('\\')) {
    return res.status(400).json({ message: 'Invalid path request' });
  }

  // 3. Block restricted system directories & source files
  for (const forbiddenPath of FORBIDDEN_PATHS) {
    if (reqPath.startsWith(forbiddenPath) || reqPath.includes(forbiddenPath)) {
      return res.status(403).json({ message: 'Access Denied: Restricted system path' });
    }
  }

  // 4. Block restricted file extensions
  const ext = path.extname(reqPath);
  if (ext && FORBIDDEN_EXTENSIONS.includes(ext)) {
    return res.status(403).json({ message: 'Access Denied: Restricted file extension' });
  }

  next();
}

module.exports = securityGuard;
