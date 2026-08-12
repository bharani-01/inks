const prisma = require('../config/db');
const crypto = require('crypto');

/**
 * POST /api/batch-orders
 * Create a batch order from cart items
 */
async function createBatchOrder(req, res) {
  try {
    const { items, paymentMethod = 'WALLET', couponCode } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: 'At least one item is required' });
    }

    if (items.length > 20) {
      return res.status(400).json({ message: 'Maximum 20 items per batch' });
    }

    const { DEFAULT_PRICING } = require('./settings.controller');
    const { assertRedeemable } = require('../utils/coupon');

    // Fetch pricing rules
    let pricing;
    try {
      const setting = await prisma.systemSetting.findUnique({ where: { key: 'pricing_rules' } });
      pricing = setting ? JSON.parse(setting.value) : DEFAULT_PRICING;
    } catch {
      pricing = DEFAULT_PRICING;
    }

    // Validate all documents belong to user
    const docIds = items.map(i => parseInt(i.documentId)).filter(id => !isNaN(id));
    const docs = await prisma.document.findMany({
      where: { id: { in: docIds }, userId: req.user.id },
    });
    const docMap = Object.fromEntries(docs.map(d => [d.id, d]));

    // Calculate individual breakdowns
    const { calculateOrderBreakdown } = require('./order.controller');

    let batchSubtotal = 0;
    const orderDataList = [];

    for (const item of items) {
      const docId = parseInt(item.documentId);
      const doc = docMap[docId];
      if (!doc) {
        return res.status(400).json({ message: `Document ID ${item.documentId} not found or access denied` });
      }

      const opts = {
        colorMode: item.colorMode || 'BW',
        paperSize: item.paperSize || 'A4',
        sides: item.sides || 'SINGLE',
        copies: Math.max(1, parseInt(item.copies) || 1),
        binding: item.binding || 'none',
        totalPages: Math.max(1, parseInt(item.totalPages) || doc.pageCount || 1),
      };

      const breakdown = calculateOrderBreakdown(opts, pricing, 0);
      batchSubtotal += breakdown.totalAmount;

      const orderNumber = `PRT-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`;
      const qrToken = crypto.randomUUID();

      orderDataList.push({
        orderNumber,
        userId: req.user.id,
        documentId: doc.id,
        colorMode: opts.colorMode,
        paperSize: opts.paperSize,
        sides: opts.sides,
        orientation: item.orientation || 'PORTRAIT',
        copies: opts.copies,
        pageRange: item.pageRange || 'all',
        binding: opts.binding,
        instructions: item.instructions || null,
        totalPages: opts.totalPages,
        subtotal: breakdown.subtotal,
        tax: breakdown.tax,
        totalAmount: breakdown.totalAmount,
        paymentStatus: 'PENDING',
        paymentMethod: paymentMethod || 'WALLET',
        orderStatus: 'RECEIVED',
        qrToken,
        discountAmount: 0,
      });
    }

    const batchNumber = `BATCH-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`;

    // Create batch order with all child orders in a transaction
    const result = await prisma.$transaction(async (tx) => {
      const batch = await tx.batchOrder.create({
        data: {
          batchNumber,
          userId: req.user.id,
          totalAmount: Math.round(batchSubtotal * 100) / 100,
          paymentStatus: 'PENDING',
          paymentMethod: paymentMethod || 'WALLET',
        },
      });

      const createdOrders = [];
      for (const od of orderDataList) {
        const order = await tx.order.create({
          data: { ...od, batchOrderId: batch.id },
          include: {
            document: { select: { id: true, originalName: true, mimeType: true, fileSize: true } },
          },
        });
        createdOrders.push(order);
      }

      return { batch, orders: createdOrders };
    });

    res.status(201).json({
      batch: result.batch,
      orders: result.orders,
      message: `Batch order created with ${result.orders.length} items`,
    });
  } catch (err) {
    console.error('CreateBatchOrder error:', err);
    res.status(err.status || 500).json({ message: err.message || 'Failed to create batch order' });
  }
}

/**
 * GET /api/batch-orders
 */
async function getUserBatchOrders(req, res) {
  try {
    const batches = await prisma.batchOrder.findMany({
      where: { userId: req.user.id },
      include: {
        orders: {
          include: { document: { select: { id: true, originalName: true, mimeType: true } } },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
    res.json({ batches });
  } catch (err) {
    console.error('GetUserBatchOrders error:', err);
    res.status(500).json({ message: 'Failed to fetch batch orders' });
  }
}

/**
 * GET /api/batch-orders/:id
 */
async function getBatchOrderById(req, res) {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ message: 'Invalid batch order ID' });

    const batch = await prisma.batchOrder.findUnique({
      where: { id },
      include: {
        orders: {
          include: {
            document: { select: { id: true, originalName: true, mimeType: true, fileSize: true } },
          },
        },
        user: { select: { id: true, name: true, email: true } },
      },
    });

    if (!batch) return res.status(404).json({ message: 'Batch order not found' });
    if (batch.userId !== req.user.id && req.user.role !== 'ADMIN') {
      return res.status(403).json({ message: 'Access denied' });
    }

    res.json({ batch });
  } catch (err) {
    console.error('GetBatchOrderById error:', err);
    res.status(500).json({ message: 'Failed to fetch batch order' });
  }
}

module.exports = { createBatchOrder, getUserBatchOrders, getBatchOrderById };
