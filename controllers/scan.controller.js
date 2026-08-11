/**
 * Scan Controller
 * Handles QR code scan actions:
 *   GET  /api/scan/:token          — look up order by token (public)
 *   POST /api/scan/:token/deliver  — mark order DELIVERED (PRINTER_ADMIN/ADMIN only)
 *   POST /api/scan/:token/feedback — submit customer feedback (public/customer)
 */

const prisma = require('../config/db');
const { createNotification } = require('../services/notification.service');

const PRINTER_ROLES = ['ADMIN', 'PRINTER_ADMIN'];

/**
 * GET /api/scan/:token
 * Returns order summary, delivery status, and feedback status for the scan page.
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
        feedbacks: {
          select: { id: true, rating: true, message: true, featureSuggestion: true, createdAt: true },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!order) {
      return res.status(404).json({ message: 'QR code not found or expired' });
    }

    const hasFeedback = Boolean(order.feedbacks && order.feedbacks.length > 0);
    const existingFeedback = hasFeedback ? order.feedbacks[0] : null;

    res.json({
      tokenUsed: order.qrTokenUsed,
      isDelivered: order.orderStatus === 'DELIVERED',
      hasFeedback,
      feedback: existingFeedback,
      order: {
        id: order.id,
        orderNumber: order.orderNumber,
        orderStatus: order.orderStatus,
        paymentStatus: order.paymentStatus,
        totalAmount: order.totalAmount,
        colorMode: order.colorMode,
        paperSize: order.paperSize,
        orientation: order.orientation || 'PORTRAIT',
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
 * Marks order as DELIVERED.
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

    if (order.orderStatus === 'DELIVERED') {
      return res.status(200).json({
        message: `Order ${order.orderNumber} is already delivered`,
        order: { id: order.id, orderStatus: 'DELIVERED' },
      });
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
        message: `Your print order ${order.orderNumber} has been marked as delivered. Thank you for choosing Inks by Trackify!`,
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
 * Saves customer feedback.
 * Public — no auth required.
 * Allows submission even after delivery (once per order).
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

    // Check if feedback already submitted for this order
    const existing = await prisma.feedback.findFirst({
      where: { orderId: order.id },
    });

    if (existing) {
      return res.status(409).json({ message: 'Feedback has already been submitted for this order. Thank you!' });
    }

    // Validate rating if provided
    if (rating !== undefined && rating !== null) {
      const r = parseInt(rating);
      if (isNaN(r) || r < 1 || r > 5) {
        return res.status(400).json({ message: 'Rating must be between 1 and 5' });
      }
    }

    const newFeedback = await prisma.feedback.create({
      data: {
        orderId: order.id,
        rating: rating ? parseInt(rating) : null,
        message: message ? String(message).slice(0, 2000) : null,
        featureSuggestion: featureSuggestion ? String(featureSuggestion).slice(0, 1000) : null,
      },
    });

/**
 * POST /api/scan/:token/status
 * Updates order status (e.g. PROCESSING, PRINTED, DELIVERED).
 * Requires PRINTER_ADMIN or ADMIN authentication.
 * Body: { status }
 */
async function updateOrderStatusByScan(req, res) {
  try {
    const { token } = req.params;
    const { status } = req.body;

    const validStatuses = ['RECEIVED', 'PROCESSING', 'PRINTED', 'DELIVERED', 'CANCELLED'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ message: `Invalid status. Must be one of: ${validStatuses.join(', ')}` });
    }

    if (!PRINTER_ROLES.includes(req.user?.role)) {
      return res.status(403).json({ message: 'Only printer staff can update order status' });
    }

    const order = await prisma.order.findUnique({
      where: { qrToken: token },
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
    });

    if (!order) {
      return res.status(404).json({ message: 'QR code not found' });
    }

    const updated = await prisma.order.update({
      where: { id: order.id },
      data: {
        orderStatus: status,
        qrTokenUsed: status === 'DELIVERED' ? true : order.qrTokenUsed,
      },
    });

    // Notify customer on status update
    if (order.user?.id) {
      let title = 'Order Update';
      let message = `Your print order ${order.orderNumber} status is now ${status}.`;
      if (status === 'PRINTED') {
        title = 'Order Printed & Ready';
        message = `Your print order ${order.orderNumber} is printed and ready!`;
      } else if (status === 'DELIVERED') {
        title = 'Order Delivered';
        message = `Your print order ${order.orderNumber} has been delivered. Thank you for choosing Inks by Trackify!`;
      } else if (status === 'PROCESSING') {
        title = 'Printing in Progress';
        message = `Your print order ${order.orderNumber} is now being processed on the printer.`;
      }

      createNotification({
        userId: order.user.id,
        title,
        message,
        type: 'ORDER',
        link: `/user/orders?track=${order.orderNumber}`,
      }).catch(() => {});
    }

    res.json({
      message: `Order ${order.orderNumber} updated to ${status}`,
      order: { id: updated.id, orderStatus: updated.orderStatus },
    });
  } catch (err) {
    console.error('UpdateOrderStatusByScan error:', err);
    res.status(500).json({ message: 'Failed to update order status' });
  }
}

module.exports = { getScanInfo, markDelivered, updateOrderStatusByScan, submitFeedback };
