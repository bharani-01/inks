const express = require('express');
const router = express.Router();
const authenticate = require('../middleware/auth');
const requireRole = require('../middleware/roleCheck');
const {
  getRevenue,
  getOrdersHeatmap,
  getUserFunnel,
  getTopDocuments,
  getCouponRoi,
  getConsumption,
  exportReport,
} = require('../controllers/analytics.controller');

router.use(authenticate);
router.use(requireRole('ADMIN', 'PRINTER_ADMIN'));

router.get('/revenue', getRevenue);
router.get('/orders-heatmap', getOrdersHeatmap);
router.get('/user-funnel', getUserFunnel);
router.get('/top-documents', getTopDocuments);
router.get('/coupon-roi', getCouponRoi);
router.get('/consumption', getConsumption);
router.get('/export', exportReport);

module.exports = router;
