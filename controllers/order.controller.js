const prisma = require('../config/db');
const { DEFAULT_PRICING } = require('./settings.controller');

/**
 * Fetch current pricing rules
 */
async function getPricingRules() {
  try {
    const setting = await prisma.systemSetting.findUnique({ where: { key: 'pricing_rules' } });
    return setting ? JSON.parse(setting.value) : DEFAULT_PRICING;
  } catch {
    return DEFAULT_PRICING;
  }
}

/**
 * Calculate order pricing breakdown
 */
function calculateOrderBreakdown(options, pricing) {
  const {
    colorMode = 'BW',
    paperSize = 'A4',
    sides = 'SINGLE',
    copies = 1,
    binding = 'none',
    totalPages = 1,
  } = options;

  // Page rate
  let pageRate = colorMode === 'COLOR' ? pricing.colorRate : pricing.bwRate;
  
  // Duplex discount
  if (sides === 'DOUBLE') {
    pageRate = pageRate * (1 - (pricing.duplexDiscount || 0));
  }

  // Paper multiplier
  const paperMultiplier = pricing.paperSizeMultipliers?.[paperSize] || 1.0;
  const effectivePageRate = pageRate * paperMultiplier;

  // Print subtotal
  const printCost = effectivePageRate * totalPages * Math.max(1, copies);

  // Binding cost
  const bindingCost = (pricing.bindingRates?.[binding] || 0) * Math.max(1, copies);

  const subtotal = Math.round((printCost + bindingCost) * 100) / 100;
  const taxRate = pricing.taxRate || 0.18;
  const tax = Math.round(subtotal * taxRate * 100) / 100;
  const totalAmount = Math.round((subtotal + tax) * 100) / 100;

  return {
    basePageRate: pageRate,
    effectivePageRate,
    totalPages,
    copies,
    printCost: Math.round(printCost * 100) / 100,
    bindingCost,
    subtotal,
    taxRate,
    tax,
    totalAmount,
  };
}

/**
 * Calculate price API
 * POST /api/orders/calculate
 */
async function calculatePrice(req, res) {
  try {
    const pricing = await getPricingRules();
    const breakdown = calculateOrderBreakdown(req.body, pricing);
    res.json({ breakdown, pricing });
  } catch (err) {
    console.error('CalculatePrice error:', err);
    res.status(500).json({ message: 'Price calculation failed' });
  }
}

/**
 * Create print order with simulated payment
 * POST /api/orders
 */
async function createOrder(req, res) {
  try {
    const {
      documentId,
      colorMode = 'BW',
      paperSize = 'A4',
      sides = 'SINGLE',
      copies = 1,
      pageRange = 'all',
      binding = 'none',
      instructions = '',
      paymentMethod = 'SIMULATED_GATEWAY',
      totalPages = 1,
    } = req.body;

    const docId = parseInt(documentId);
    if (isNaN(docId)) {
      return res.status(400).json({ message: 'Document ID is required' });
    }

    // Verify document ownership
    const doc = await prisma.document.findUnique({ where: { id: docId } });
    if (!doc || (doc.userId !== req.user.id && req.user.role !== 'ADMIN')) {
      return res.status(404).json({ message: 'Document not found' });
    }

    const pricing = await getPricingRules();
    const breakdown = calculateOrderBreakdown(
      { colorMode, paperSize, sides, copies, binding, totalPages },
      pricing
    );

    // Generate unique order number
    const orderNumber = `PRT-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`;

    const order = await prisma.order.create({
      data: {
        orderNumber,
        userId: req.user.id,
        documentId: doc.id,
        colorMode,
        paperSize,
        sides,
        copies: Math.max(1, parseInt(copies) || 1),
        pageRange: pageRange || 'all',
        binding,
        instructions: instructions || null,
        totalPages: Math.max(1, parseInt(totalPages) || 1),
        subtotal: breakdown.subtotal,
        tax: breakdown.tax,
        totalAmount: breakdown.totalAmount,
        paymentStatus: 'PAID', // Simulated successful payment
        paymentMethod,
        orderStatus: 'RECEIVED',
      },
      include: {
        document: {
          select: {
            id: true,
            originalName: true,
            mimeType: true,
            fileSize: true,
          },
        },
      },
    });

    // Update document status to PROCESSING
    await prisma.document.update({
      where: { id: doc.id },
      data: { status: 'PROCESSING' },
    });

    res.status(201).json({
      order,
      message: 'Print order placed successfully',
    });
  } catch (err) {
    console.error('CreateOrder error:', err);
    res.status(500).json({ message: 'Failed to create print order' });
  }
}

/**
 * List logged-in user's orders
 * GET /api/orders/my-orders?page=1&limit=10
 */
async function getUserOrders(req, res) {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 10));

    const where = { userId: req.user.id };

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        include: {
          document: {
            select: {
              id: true,
              originalName: true,
              mimeType: true,
            },
          },
        },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.order.count({ where }),
    ]);

    res.json({
      orders,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    console.error('GetUserOrders error:', err);
    res.status(500).json({ message: 'Failed to fetch orders' });
  }
}

/**
 * Get single order details
 * GET /api/orders/:id
 */
async function getOrderById(req, res) {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ message: 'Invalid order ID' });

    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        document: true,
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
          },
        },
      },
    });

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    if (order.userId !== req.user.id && req.user.role !== 'ADMIN') {
      return res.status(403).json({ message: 'Access denied' });
    }

    res.json({ order });
  } catch (err) {
    console.error('GetOrderById error:', err);
    res.status(500).json({ message: 'Failed to fetch order details' });
  }
}

/**
 * Public Order Tracking by Order Number
 * GET /api/orders/track/:orderNumber
 */
async function trackOrderByNumber(req, res) {
  try {
    const { orderNumber } = req.params;

    if (!orderNumber) {
      return res.status(400).json({ message: 'Order number is required' });
    }

    const order = await prisma.order.findUnique({
      where: { orderNumber: orderNumber.trim() },
      include: {
        document: {
          select: {
            originalName: true,
            mimeType: true,
            fileSize: true,
          },
        },
        user: {
          select: {
            name: true,
          },
        },
      },
    });

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    res.json({ order });
  } catch (err) {
    console.error('TrackOrderByNumber error:', err);
    res.status(500).json({ message: 'Failed to track order' });
  }
}

/**
 * Admin: List all orders
 * GET /api/admin/orders?page=1&limit=10&status=&search=
 */
async function getAdminOrders(req, res) {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 10));
    const statusFilter = req.query.status || '';
    const search = req.query.search || '';

    const where = {};
    if (statusFilter && ['RECEIVED', 'PROCESSING', 'PRINTED', 'DELIVERED', 'CANCELLED'].includes(statusFilter)) {
      where.orderStatus = statusFilter;
    }

    if (search) {
      where.OR = [
        { orderNumber: { contains: search, mode: 'insensitive' } },
        { user: { name: { contains: search, mode: 'insensitive' } } },
        { user: { email: { contains: search, mode: 'insensitive' } } },
        { document: { originalName: { contains: search, mode: 'insensitive' } } },
      ];
    }

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        include: {
          user: {
            select: { id: true, name: true, email: true, phone: true },
          },
          document: {
            select: { id: true, originalName: true, mimeType: true, fileSize: true },
          },
        },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.order.count({ where }),
    ]);

    res.json({
      orders,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    console.error('GetAdminOrders error:', err);
    res.status(500).json({ message: 'Failed to fetch admin orders' });
  }
}

/**
 * Admin: Update order status
 * PUT /api/admin/orders/:id/status
 */
async function updateOrderStatus(req, res) {
  try {
    const id = parseInt(req.params.id);
    const { orderStatus } = req.body;

    if (isNaN(id)) return res.status(400).json({ message: 'Invalid order ID' });

    const validStatuses = ['RECEIVED', 'PROCESSING', 'PRINTED', 'DELIVERED', 'CANCELLED'];
    if (!validStatuses.includes(orderStatus)) {
      return res.status(400).json({ message: 'Invalid order status' });
    }

    const updated = await prisma.order.update({
      where: { id },
      data: { orderStatus },
      include: {
        document: true,
        user: { select: { id: true, name: true, email: true } },
      },
    });

    // Update document status if printed
    if (orderStatus === 'PRINTED' || orderStatus === 'DELIVERED') {
      await prisma.document.update({
        where: { id: updated.documentId },
        data: { status: 'PRINTED' },
      });
    }

    res.json({ order: updated, message: `Order status updated to ${orderStatus}` });
  } catch (err) {
    console.error('UpdateOrderStatus error:', err);
    res.status(500).json({ message: 'Failed to update order status' });
  }
}

/**
 * Admin: Get Order Statistics
 * GET /api/admin/orders/stats
 */
async function getAdminOrderStats(req, res) {
  try {
    const [
      totalOrders,
      received,
      processing,
      printed,
      delivered,
      cancelled,
      revenueResult,
      totalUsers,
      totalDocuments,
      colorCount,
      bwCount,
      allOrdersForPages,
      recentOrders,
    ] = await Promise.all([
      prisma.order.count(),
      prisma.order.count({ where: { orderStatus: 'RECEIVED' } }),
      prisma.order.count({ where: { orderStatus: 'PROCESSING' } }),
      prisma.order.count({ where: { orderStatus: 'PRINTED' } }),
      prisma.order.count({ where: { orderStatus: 'DELIVERED' } }),
      prisma.order.count({ where: { orderStatus: 'CANCELLED' } }),
      prisma.order.aggregate({
        _sum: { totalAmount: true },
        where: { paymentStatus: 'PAID' },
      }),
      prisma.user.count(),
      prisma.document.count(),
      prisma.order.count({ where: { colorMode: 'COLOR' } }),
      prisma.order.count({ where: { colorMode: 'BW' } }),
      prisma.order.findMany({ select: { totalPages: true, copies: true } }),
      prisma.order.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { name: true, email: true } },
          document: { select: { originalName: true } },
        },
      }),
    ]);

    const totalRevenue = revenueResult._sum.totalAmount || 0;
    const avgOrderValue = totalOrders > 0 ? (totalRevenue / totalOrders) : 0;
    const totalPagesPrinted = allOrdersForPages.reduce((acc, curr) => acc + ((curr.totalPages || 1) * (curr.copies || 1)), 0);

    res.json({
      totalOrders,
      received,
      processing,
      printed,
      delivered,
      cancelled,
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      avgOrderValue: Math.round(avgOrderValue * 100) / 100,
      totalUsers,
      totalDocuments,
      totalPagesPrinted,
      colorCount,
      bwCount,
      recentOrders,
    });
  } catch (err) {
    console.error('GetAdminOrderStats error:', err);
    res.status(500).json({ message: 'Failed to fetch order statistics' });
  }
}

module.exports = {
  calculatePrice,
  createOrder,
  getUserOrders,
  getOrderById,
  trackOrderByNumber,
  getAdminOrders,
  updateOrderStatus,
  getAdminOrderStats,
};
