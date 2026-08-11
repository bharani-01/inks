/**
 * Scan Controller
 * Handles QR code scan actions:
 *   GET  /api/scan/:token          — look up order by token (public)
 *   POST /api/scan/:token/deliver  — mark order DELIVERED (PRINTER_ADMIN/ADMIN only)
 *   POST /api/scan/:token/feedback — submit customer feedback (public/user)
 */

const prisma = require('../config/db');
const { createNotification } = require('../services/notification.service');

const PRINTER_ROLES = ['ADMIN', 'PRINTER_ADMIN'];

/**
 * GET /api/scan/:token
 * Returns order summary and token status for the scan page.
 * Public endpoint — no auth required.
 */
async function getScanInfo(req, res) {
  try {
    const { token } = req.params;
    if (!token || typeof token !== 'string') {
      return res.status(400).json({ message: 'Invalid token' });
    }

    const order = await prisma.order.findUnique({
      where: { qrToken: token },
      include: {
        user: { select: { id: true, name: true, email: true } },
        document: { select: { originalName: true, mimeType: true } },
      },
    });

    if (!order) {
      return res.status(404).json({ message: 'QR code not found or expired' });
    }

    res.json({
      tokenUsed: order.qrTokenUsed,
      order: {
        id: order.id,
        orderNumber: order.orderNumber,
        orderStatus: order.orderStatus,
        paymentStatus: order.paymentStatus,
        totalAmount: order.totalAmount,
        colorMode: order.colorMode,
        paperSize: order.paperSize,
        sides: order.sides,
        copies: order.copies,
        totalPages: order.totalPages,
        binding: order.binding,
        instructions: order.instructions,
        createdAt: order.createdAt,
        customer: order.user?.name || 'Customer',
        documentName: order.document?.originalName || 'Document',
      },
    });
  } catch (err) {
    console.error('GetScanInfo error:', err);
    res.status(500).json({ message: 'Failed to load QR scan info' });
  }
}

/**
 * POST /api/scan/:token/deliver
 * Marks order as DELIVERED and burns the token.
 * Requires PRINTER_ADMIN or ADMIN authentication.
 */
async function markDelivered(req, res) {
  try {
    const { token } = req.params;

    const order = await prisma.order.findUnique({
      where: { qrToken: token },
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
    });

    if (!order) {
      return res.status(404).json({ message: 'QR code not found' });
    }

    if (order.qrTokenUsed) {
      return res.status(409).json({ message: 'This QR code has already been used' });
    }

    if (!PRINTER_ROLES.includes(req.user?.role)) {
      return res.status(403).json({ message: 'Only printer staff can mark orders as delivered' });
    }

    const updated = await prisma.order.update({
      where: { id: order.id },
      data: {
        orderStatus: 'DELIVERED',
        qrTokenUsed: true,
      },
    });

    // Notify customer
    if (order.user?.id) {
      createNotification({
        userId: order.user.id,
        title: 'Order Delivered',
        message: `Your print order ${order.orderNumber} has been marked as delivered. Thank you for using Inks by Trackify!`,
        type: 'ORDER',
        link: `/user/orders?track=${order.orderNumber}`,
      }).catch(() => {});
    }

    res.json({
      message: `Order ${order.orderNumber} marked as delivered successfully`,
      order: { id: updated.id, orderStatus: updated.orderStatus },
    });
  } catch (err) {
    console.error('MarkDelivered error:', err);
    res.status(500).json({ message: 'Failed to mark order as delivered' });
  }
}

/**
 * POST /api/scan/:token/feedback
 * Saves customer feedback and burns the token.
 * Public — no auth required.
 * Body: { rating, message, featureSuggestion }
 */
async function submitFeedback(req, res) {
  try {
    const { token } = req.params;
    const { rating, message, featureSuggestion } = req.body;

    const order = await prisma.order.findUnique({
      where: { qrToken: token },
    });

    if (!order) {
      return res.status(404).json({ message: 'QR code not found' });
    }

    if (order.qrTokenUsed) {
      return res.status(409).json({ message: 'This QR code has already been used' });
    }

    // Validate rating if provided
    if (rating !== undefined && rating !== null) {
      const r = parseInt(rating);
      if (isNaN(r) || r < 1 || r > 5) {
        return res.status(400).json({ message: 'Rating must be between 1 and 5' });
      }
    }

    await prisma.$transaction([
      prisma.feedback.create({
        data: {
          orderId: order.id,
          rating: rating ? parseInt(rating) : null,
          message: message ? String(message).slice(0, 2000) : null,
          featureSuggestion: featureSuggestion ? String(featureSuggestion).slice(0, 1000) : null,
        },
      }),
      prisma.order.update({
        where: { id: order.id },
        data: { qrTokenUsed: true },
      }),
    ]);

    res.json({ message: 'Thank you for your feedback!' });
  } catch (err) {
    console.error('SubmitFeedback error:', err);
    res.status(500).json({ message: 'Failed to submit feedback' });
  }
}

module.exports = { getScanInfo, markDelivered, submitFeedback };
