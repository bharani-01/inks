const securityGuard = require('../../middleware/securityGuard');

describe('Security Guard Middleware Unit Test Suite (middleware/securityGuard.js)', () => {
  let req, res, next;

  beforeEach(() => {
    req = { path: '' };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    next = jest.fn();
  });

  describe('Allowed Static Public Files', () => {
    const allowedPaths = ['/manifest.json', '/animation.json', '/sw.js', '/favicon.ico'];

    allowedPaths.forEach((pathStr) => {
      it(`should allow static file ${pathStr}`, () => {
        req.path = pathStr;
        securityGuard(req, res, next);
        expect(next).toHaveBeenCalled();
        expect(res.status).not.toHaveBeenCalled();
      });
    });
  });

  describe('Dotfiles & Environment Files Protection', () => {
    const dotfilePaths = ['/.env', '/.env.production', '/.git/config', '/.gitignore', '/.dockerignore', '/var/.env'];

    dotfilePaths.forEach((pathStr) => {
      it(`should block access to dotfile ${pathStr} with 403 Forbidden`, () => {
        req.path = pathStr;
        securityGuard(req, res, next);
        expect(res.status).toHaveBeenCalledWith(403);
        expect(res.json).toHaveBeenCalledWith({ message: 'Access Denied: Restricted file' });
        expect(next).not.toHaveBeenCalled();
      });
    });
  });

  describe('Path Traversal Attack Protection', () => {
    const traversalPaths = [
      '/api/documents/%2e%2e/config',
      '/uploads\\secrets.txt',
    ];

    traversalPaths.forEach((pathStr) => {
      it(`should block path traversal attempt ${pathStr} with 400 Bad Request`, () => {
        req.path = pathStr;
        securityGuard(req, res, next);
        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({ message: 'Invalid path request' });
        expect(next).not.toHaveBeenCalled();
      });
    });
  });

  describe('Restricted Source Directories & Server Code Protection', () => {
    const restrictedPaths = [
      '/controllers/order.controller.js',
      '/routes/admin.routes.js',
      '/middleware/auth.js',
      '/services/email.service.js',
      '/config/db.js',
      '/prisma/schema.prisma',
      '/uploads/private_doc.pdf',
      '/node_modules/express/package.json',
      '/utils/coupon.js',
      '/package.json',
      '/package-lock.json',
      '/server.js',
    ];

    restrictedPaths.forEach((pathStr) => {
      it(`should block access to internal path ${pathStr} with 403`, () => {
        req.path = pathStr;
        securityGuard(req, res, next);
        expect(res.status).toHaveBeenCalledWith(403);
        expect(res.json).toHaveBeenCalledWith({ message: 'Access Denied: Restricted system path' });
        expect(next).not.toHaveBeenCalled();
      });
    });
  });

  describe('Forbidden File Extensions', () => {
    const forbiddenExts = [
      '/data/dump.sql',
      '/scripts/deploy.sh',
      '/script.bat',
      '/script.cmd',
      '/script.ps1',
      '/app.log',
      '/readme.md',
      '/yarn.lock',
    ];

    forbiddenExts.forEach((pathStr) => {
      it(`should block file with forbidden extension ${pathStr} with 403`, () => {
        req.path = pathStr;
        securityGuard(req, res, next);
        expect(res.status).toHaveBeenCalledWith(403);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringMatching(/Restricted/) }));
        expect(next).not.toHaveBeenCalled();
      });
    });
  });

  describe('Normal Client App & API Routes', () => {
    const validRoutes = [
      '/',
      '/login',
      '/register',
      '/print',
      '/track/PRT-123456',
      '/api/auth/login',
      '/api/orders',
      '/api/wallet/balance',
      '/api/scan/verify',
    ];

    validRoutes.forEach((routeStr) => {
      it(`should allow standard application route ${routeStr}`, () => {
        req.path = routeStr;
        securityGuard(req, res, next);
        expect(next).toHaveBeenCalled();
        expect(res.status).not.toHaveBeenCalled();
      });
    });
  });
});
