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
  downloadOrderInvoice,
  submitOrderUtr,
  verifyOrderPayment,
  rejectOrderPayment,
  getAdminPayments,
} = require('../controllers/order.controller');

// Public route for tracking print progress via order code
router.get('/track/:orderNumber', trackOrderByNumber);

// All subsequent routes require authentication
router.use(authenticate);

// User order routes
router.post('/calculate', calculatePrice);
router.post('/', createOrder);
router.get('/my-orders', getUserOrders);

// Admin order routes & payment verification (placed before :id route)
router.get('/admin/payments', requireRole('ADMIN'), getAdminPayments);
router.post('/admin/:id/verify-payment', requireRole('ADMIN'), verifyOrderPayment);
router.post('/admin/:id/reject-payment', requireRole('ADMIN'), rejectOrderPayment);
router.get('/', requireRole('ADMIN'), getAdminOrders);
router.get('/stats', requireRole('ADMIN'), getAdminOrderStats);
router.get('/admin/all', requireRole('ADMIN'), getAdminOrders);
router.get('/admin/stats', requireRole('ADMIN'), getAdminOrderStats);
router.put('/admin/:id/status', requireRole('ADMIN'), updateOrderStatus);

// Single order details, UTR submission & invoice download
router.post('/:id/submit-utr', submitOrderUtr);
router.get('/:id/invoice', downloadOrderInvoice);
router.get('/:id', getOrderById);

module.exports = router;
