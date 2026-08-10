const express = require('express');
const router = express.Router();
const authenticate = require('../middleware/auth');
const requireRole = require('../middleware/roleCheck');
const {
  calculatePrice,
  createOrder,
  getUserOrders,
  getOrderById,
  trackOrderByNumber,
  getAdminOrders,
  updateOrderStatus,
  getAdminOrderStats,
} = require('../controllers/order.controller');

// Public route for tracking print progress via order code
router.get('/track/:orderNumber', trackOrderByNumber);

// All subsequent routes require authentication
router.use(authenticate);

// User order routes
router.post('/calculate', calculatePrice);
router.post('/', createOrder);
router.get('/my-orders', getUserOrders);

// Admin order routes (placed before :id route)
router.get('/', requireRole('ADMIN'), getAdminOrders);
router.get('/stats', requireRole('ADMIN'), getAdminOrderStats);
router.get('/admin/all', requireRole('ADMIN'), getAdminOrders);
router.get('/admin/stats', requireRole('ADMIN'), getAdminOrderStats);
router.put('/admin/:id/status', requireRole('ADMIN'), updateOrderStatus);

// Single order details
router.get('/:id', getOrderById);

module.exports = router;
