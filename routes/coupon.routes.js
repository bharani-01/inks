const express = require('express');
const router = express.Router();
const couponController = require('../controllers/coupon.controller');
const authenticate = require('../middleware/auth');
const requireRole = require('../middleware/roleCheck');

// Public/User routes
router.post('/validate', authenticate, couponController.validateCoupon);

// Admin only routes
router.get('/analytics', authenticate, requireRole('ADMIN'), couponController.getCouponAnalytics);
router.get('/:id/details', authenticate, requireRole('ADMIN'), couponController.getCouponDetails);
router.get('/', authenticate, requireRole('ADMIN'), couponController.listCoupons);
router.post('/', authenticate, requireRole('ADMIN'), couponController.createCoupon);
router.put('/:id', authenticate, requireRole('ADMIN'), couponController.updateCoupon);
router.delete('/:id', authenticate, requireRole('ADMIN'), couponController.deleteCoupon);

module.exports = router;
