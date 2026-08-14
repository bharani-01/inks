const jwt = require('jsonwebtoken');
const authenticate = require('../../middleware/auth');
const requireRole = require('../../middleware/roleCheck');

describe('Middleware Unit Tests', () => {
  const JWT_SECRET = 'test-secret-123';
  const originalEnv = process.env.JWT_SECRET;

  beforeAll(() => {
    process.env.JWT_SECRET = JWT_SECRET;
  });

  afterAll(() => {
    process.env.JWT_SECRET = originalEnv;
  });

  describe('authenticate middleware', () => {
    let req, res, next;

    beforeEach(() => {
      req = { headers: {}, query: {} };
      res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };
      next = jest.fn();
    });

    it('should return 401 if no Authorization header or query token provided', () => {
      authenticate(req, res, next);
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ message: 'Authentication required' });
      expect(next).not.toHaveBeenCalled();
    });

    it('should authenticate correctly with Bearer token in header', () => {
      const payload = { id: 42, role: 'USER', email: 'user@example.com' };
      const token = jwt.sign(payload, JWT_SECRET);
      req.headers.authorization = `Bearer ${token}`;

      authenticate(req, res, next);

      expect(req.user).toBeDefined();
      expect(req.user.id).toBe(42);
      expect(req.user.role).toBe('USER');
      expect(next).toHaveBeenCalled();
    });

    it('should authenticate correctly with query token parameter', () => {
      const payload = { id: 10, role: 'ADMIN', email: 'admin@example.com' };
      const token = jwt.sign(payload, JWT_SECRET);
      req.query.token = token;

      authenticate(req, res, next);

      expect(req.user).toBeDefined();
      expect(req.user.id).toBe(10);
      expect(req.user.role).toBe('ADMIN');
      expect(next).toHaveBeenCalled();
    });

    it('should return 401 if token is expired', () => {
      const token = jwt.sign({ id: 1, role: 'USER' }, JWT_SECRET, { expiresIn: -1 });
      req.headers.authorization = `Bearer ${token}`;

      authenticate(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ message: 'Session expired. Please login again.' });
      expect(next).not.toHaveBeenCalled();
    });

    it('should return 401 if token signature is invalid', () => {
      const token = jwt.sign({ id: 1, role: 'USER' }, 'wrong-secret');
      req.headers.authorization = `Bearer ${token}`;

      authenticate(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ message: 'Invalid token' });
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('requireRole middleware', () => {
    let req, res, next;

    beforeEach(() => {
      req = {};
      res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };
      next = jest.fn();
    });

    it('should return 401 if req.user is undefined', () => {
      const middleware = requireRole('ADMIN');
      middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ message: 'Authentication required' });
      expect(next).not.toHaveBeenCalled();
    });

    it('should return 403 if user role is not allowed', () => {
      req.user = { id: 1, role: 'USER' };
      const middleware = requireRole('ADMIN', 'PRINTER_ADMIN');
      middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ message: 'Insufficient permissions' });
      expect(next).not.toHaveBeenCalled();
    });

    it('should call next() if user role is allowed', () => {
      req.user = { id: 1, role: 'ADMIN' };
      const middleware = requireRole('ADMIN', 'PRINTER_ADMIN');
      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
    });
  });
});
