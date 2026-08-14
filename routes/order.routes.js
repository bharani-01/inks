const express = require('express');
const router = express.Router();
const path = require('path');
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
  getPrinterOrderStats,
  getAdminPrinterStationStatus,
} = require('../controllers/order.controller');

// Public route for tracking print progress via order code
router.get('/track/:orderNumber', trackOrderByNumber);

// All subsequent routes require authentication
router.use(authenticate);

// User order routes
router.post('/calculate', calculatePrice);
router.post('/', createOrder);
router.get('/my-orders', getUserOrders);

// Admin/Printer order routes & payment verification (placed before :id route)
router.get('/admin/payments', requireRole('ADMIN', 'PRINTER_ADMIN'), getAdminPayments);
router.post('/admin/:id/verify-payment', requireRole('ADMIN', 'PRINTER_ADMIN'), verifyOrderPayment);
router.post('/admin/:id/reject-payment', requireRole('ADMIN', 'PRINTER_ADMIN'), rejectOrderPayment);
router.get('/', requireRole('ADMIN', 'PRINTER_ADMIN'), getAdminOrders);
router.get('/stats', requireRole('ADMIN', 'PRINTER_ADMIN'), getAdminOrderStats);
router.get('/printer-stats', requireRole('ADMIN', 'PRINTER_ADMIN'), getPrinterOrderStats);
router.get('/admin/stations', requireRole('ADMIN'), getAdminPrinterStationStatus);
router.get('/admin/all', requireRole('ADMIN', 'PRINTER_ADMIN'), getAdminOrders);
router.get('/admin/stats', requireRole('ADMIN', 'PRINTER_ADMIN'), getAdminOrderStats);
router.put('/admin/:id/status', requireRole('ADMIN', 'PRINTER_ADMIN', 'PRINTER_AGENT'), updateOrderStatus);

const { generateCoverPage, generateMergedPrintDocument } = require('../services/coverPage.service');
const crypto = require('crypto');
const prisma = require('../config/db');

const UPLOADS_DIR = path.normalize(path.resolve(__dirname, '..', 'uploads'));

// Merged Print-Ready Document (Auto-attached First Page & Last Page Security Cover)
router.get('/admin/:id/print-ready', requireRole('ADMIN', 'PRINTER_ADMIN', 'PRINTER_AGENT'), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ message: 'Invalid order ID' });

    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, name: true, email: true } },
        document: true,
      },
    });

    if (!order) return res.status(404).json({ message: 'Order not found' });

    let qrToken = order.qrToken;
    if (!qrToken) {
      qrToken = crypto.randomUUID();
      await prisma.order.update({
        where: { id: order.id },
        data: { qrToken },
      });
    }

    const appUrl = process.env.APP_URL || 'https://inks.trackifyapp.co.in';
    const scanUrl = `${appUrl}/scan/${qrToken}`;

    const rawName = order.document?.fileName || (order.document?.filePath ? path.basename(order.document.filePath) : null);
    const docPath = rawName ? path.join(UPLOADS_DIR, path.basename(rawName)) : null;

    // Fetch active system security cover mode setting
    let coverMode = 'BOTH';
    try {
      const setting = await prisma.systemSetting.findUnique({ where: { key: 'pricing_rules' } });
      if (setting?.value) {
        const parsed = JSON.parse(setting.value);
        if (parsed.securityCoverMode) coverMode = parsed.securityCoverMode;
      }
    } catch {
      /* fallback to BOTH */
    }

    const mergedBuffer = await generateMergedPrintDocument(order, docPath, scanUrl, coverMode);

    const isDownload = req.query.download === 'true';
    const filename = `Print-${order.orderNumber}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `${isDownload ? 'attachment' : 'inline'}; filename="${filename}"; filename*=UTF-8''${filename}`);
    res.send(mergedBuffer);
  } catch (err) {
    console.error('Print-ready merge error:', err);
    res.status(500).json({ message: 'Failed to generate print-ready document' });
  }
});

// Cover page standalone PDF download (staff only) — generated on-demand with QR code
router.get('/admin/:id/cover-page', requireRole('ADMIN', 'PRINTER_ADMIN'), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ message: 'Invalid order ID' });

    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, name: true, email: true } },
        document: true,
      },
    });

    if (!order) return res.status(404).json({ message: 'Order not found' });

    let qrToken = order.qrToken;
    if (!qrToken) {
      qrToken = crypto.randomUUID();
      await prisma.order.update({
        where: { id: order.id },
        data: { qrToken },
      });
    }

    const appUrl = process.env.APP_URL || 'https://inks.trackifyapp.co.in';
    const scanUrl = `${appUrl}/scan/${qrToken}`;

    const coverBuffer = await generateCoverPage(order, order.user, scanUrl, 'FRONT');

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="CoverPage-${order.orderNumber}.pdf"`);
    res.send(coverBuffer);
  } catch (err) {
    console.error('Cover page route error:', err);
    res.status(500).json({ message: 'Failed to generate cover page' });
  }
});

// Single order details, UTR submission & invoice download
router.post('/:id/submit-utr', submitOrderUtr);
router.get('/:id/invoice', downloadOrderInvoice);
router.get('/:id', getOrderById);

module.exports = router;
