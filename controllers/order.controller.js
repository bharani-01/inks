const prisma = require('../config/db');
const { DEFAULT_PRICING } = require('./settings.controller');
const { assertRedeemable } = require('../utils/coupon');
const { createNotification, notifyAdmins } = require('../services/notification.service');
const { sendPaymentInvoiceEmail, sendOrderStatusEmail, sendPaymentFailedReinitiateEmail } = require('../services/email.service');
const { generateInvoicePdfBuffer } = require('../services/invoicePdf.service');
const { generateCoverPage } = require('../services/coverPage.service');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');

const UPLOADS_DIR = path.normalize(path.resolve(__dirname, '..', 'uploads'));
const STAFF_ROLES = ['ADMIN', 'PRINTER_ADMIN'];

/**
 * Safe property accessor to prevent prototype pollution and arbitrary property lookups
 */
function getSafeProperty(obj, key, defaultValue) {
  if (obj && typeof obj === 'object' && typeof key === 'string' && Object.prototype.hasOwnProperty.call(obj, key)) {
    const val = obj[key];
    return typeof val === 'number' && !isNaN(val) ? val : defaultValue;
  }
  return defaultValue;
}

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
function calculateOrderBreakdown(options, pricing, discountAmount = 0) {
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

  // Safe paper multiplier lookup
  const paperMultiplier = getSafeProperty(pricing.paperSizeMultipliers, paperSize, 1.0);
  const effectivePageRate = pageRate * paperMultiplier;

  // Print subtotal
  const printCost = effectivePageRate * totalPages * Math.max(1, copies);

  // Safe binding cost lookup
  const bindingCost = getSafeProperty(pricing.bindingRates, binding, 0) * Math.max(1, copies);

  const subtotal = Math.round((printCost + bindingCost) * 100) / 100;
  
  // Tax is calculated on the discounted subtotal
  const taxableAmount = Math.max(0, subtotal - discountAmount);
  
  const taxRate = pricing.taxRate || 0.18;
  const tax = Math.round(taxableAmount * taxRate * 100) / 100;
  const totalAmount = Math.round((taxableAmount + tax) * 100) / 100;

  return {
    basePageRate: pageRate,
    effectivePageRate,
    totalPages,
    copies,
    printCost: Math.round(printCost * 100) / 100,
    bindingCost,
    subtotal,
    discountAmount,
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
    let breakdown = calculateOrderBreakdown(req.body, pricing, 0);

    let couponError = null;
    let couponObj = null;
    let discountAmount = 0;

    if (req.body.couponCode) {
      const coupon = await prisma.coupon.findUnique({
        where: { code: req.body.couponCode.toUpperCase().trim() }
      });
      try {
        discountAmount = await assertRedeemable(prisma, coupon, {
          userId: req.user.id,
          subtotal: breakdown.subtotal
        });
        couponObj = coupon ? {
          ...coupon,
          discountPercent: coupon.discountType === 'PERCENT' ? coupon.discountValue : null,
          discountAmount: discountAmount,
        } : null;
        breakdown = calculateOrderBreakdown(req.body, pricing, discountAmount);
      } catch (err) {
        if (err.status === 400) {
          couponError = err.message;
        } else {
          throw err;
        }
      }
    }

    res.json({ breakdown, pricing, couponError, coupon: couponObj });
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
      paymentMethod = 'WALLET',
      totalPages = 1,
      couponCode = null,
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
    let breakdown = calculateOrderBreakdown(
      { colorMode, paperSize, sides, copies, binding, totalPages },
      pricing,
      0
    );

    let discountAmount = 0;
    let coupon = null;

    if (couponCode && typeof couponCode === 'string' && couponCode.trim()) {
      coupon = await prisma.coupon.findUnique({
        where: { code: couponCode.toUpperCase().trim() }
      });
      discountAmount = await assertRedeemable(prisma, coupon, {
        userId: req.user.id,
        subtotal: breakdown.subtotal
      });
      breakdown = calculateOrderBreakdown(
        { colorMode, paperSize, sides, copies, binding, totalPages },
        pricing,
        discountAmount
      );
    }

    const { upiRefNumber } = req.body;

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
        orientation: req.body.orientation || 'PORTRAIT',
        copies: Math.max(1, parseInt(copies) || 1),
        pageRange: pageRange || 'all',
        binding,
        instructions: instructions || null,
        totalPages: Math.max(1, parseInt(totalPages) || 1),
        subtotal: breakdown.subtotal,
        tax: breakdown.tax,
        totalAmount: breakdown.totalAmount,
        paymentStatus: 'PENDING',
        paymentMethod: paymentMethod || 'WALLET',
        orderStatus: 'RECEIVED',
        upiRefNumber: upiRefNumber ? String(upiRefNumber).trim() : null,
        verifiedAt: null,
        couponId: coupon ? coupon.id : null,
        discountAmount,
        redemption: coupon ? {
          create: {
            couponId: coupon.id,
            userId: req.user.id,
            discountAmount
          }
        } : undefined
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

    // Increment coupon usage
    if (coupon) {
      await prisma.coupon.update({
        where: { id: coupon.id },
        data: { usedCount: { increment: 1 } }
      });
    }

    const customerUser = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { id: true, name: true, email: true },
    });

    const isAutoApprove = Boolean(pricing?.autoApprovePayments) && paymentMethod !== 'WALLET';

    if (isAutoApprove) {
      // Auto-approved mode: send confirmation & invoice immediately
      createNotification({
        userId: req.user.id,
        title: 'Payment Confirmed & Order Placed',
        message: `Your print order ${order.orderNumber} (₹${order.totalAmount}) has been confirmed. An invoice has been emailed to you.`,
        type: 'ORDER',
        link: `/user/orders?track=${order.orderNumber}`,
      }).catch(() => {});

      notifyAdmins({
        title: 'New Print Order Received',
        message: `Customer ${customerUser?.name || 'User'} placed order ${order.orderNumber} (₹${order.totalAmount}).`,
        type: 'ORDER',
        link: '/admin/orders',
      }).catch(() => {});

      if (customerUser && customerUser.email) {
        sendPaymentInvoiceEmail({
          to: customerUser.email,
          name: customerUser.name,
          order: {
            ...order,
            document: doc,
          },
        }).catch((err) => console.error('Failed to send invoice email:', err.message));
      }
    } else {
      // Manual verification mode (default): Order is pending payment verification
      createNotification({
        userId: req.user.id,
        title: 'Order Created — Payment Verification Pending',
        message: `Your print order ${order.orderNumber} (₹${order.totalAmount}) has been submitted. We will verify your UPI payment and email your official tax invoice once confirmed.`,
        type: 'ORDER',
        link: `/user/pay/${order.id}`,
      }).catch(() => {});

      notifyAdmins({
        title: 'Payment Verification Required',
        message: `Customer ${customerUser?.name || 'User'} submitted order ${order.orderNumber} (₹${order.totalAmount}) for UPI verification.`,
        type: 'ORDER',
        link: '/admin/payments',
      }).catch(() => {});
    }

    res.status(201).json({
      order,
      message: isAutoApprove
        ? 'Print order placed successfully'
        : 'Order submitted — awaiting payment verification',
    });
  } catch (err) {
    console.error('CreateOrder error:', err);
    res.status(err.status || 500).json({ message: err.message || 'Failed to create print order' });
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

    if (order.userId !== req.user.id && !STAFF_ROLES.includes(req.user.role)) {
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

    if (!orderNumber || orderNumber === 'undefined' || orderNumber === 'null' || !orderNumber.trim()) {
      return res.status(400).json({ message: 'Valid order number is required' });
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
 * Admin: List all orders with comprehensive sorting & filtering
 * GET /api/orders/admin/all?page=1&limit=15&status=&sortBy=&timeRange=&colorMode=&orientation=&search=
 */
async function getAdminOrders(req, res) {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 15));
    const statusQuery = (req.query.status || req.query.orderStatus || '').toUpperCase();
    const search = req.query.search || '';
    const sortBy = req.query.sortBy || 'created_desc';
    const timeRange = req.query.timeRange || '';
    const colorMode = req.query.colorMode || '';
    const orientation = req.query.orientation || '';
    const paymentStatus = req.query.paymentStatus || '';

    const where = {};
    if (statusQuery === 'UNPRINTED') {
      where.orderStatus = { in: ['RECEIVED', 'PROCESSING'] };
    } else if (statusQuery === 'COMPLETED') {
      where.orderStatus = { in: ['PRINTED', 'DELIVERED'] };
    } else if (['RECEIVED', 'PROCESSING', 'PRINTED', 'DELIVERED', 'CANCELLED'].includes(statusQuery)) {
      where.orderStatus = statusQuery;
    }

    if (colorMode && ['COLOR', 'BW'].includes(colorMode)) {
      where.colorMode = colorMode;
    }

    if (orientation && ['PORTRAIT', 'LANDSCAPE'].includes(orientation)) {
      where.orientation = orientation;
    }

    if (paymentStatus && ['PAID', 'PENDING', 'FAILED'].includes(paymentStatus)) {
      where.paymentStatus = paymentStatus;
    }

    // Time range filter
    if (timeRange) {
      const now = new Date();
      if (timeRange === '1h') {
        where.createdAt = { gte: new Date(now.getTime() - 60 * 60 * 1000) };
      } else if (timeRange === 'today') {
        const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        where.createdAt = { gte: startOfDay };
      } else if (timeRange === '24h') {
        where.createdAt = { gte: new Date(now.getTime() - 24 * 60 * 60 * 1000) };
      } else if (timeRange === 'week') {
        where.createdAt = { gte: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) };
      } else if (timeRange === 'month') {
        where.createdAt = { gte: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) };
      }
    }

    if (search) {
      where.OR = [
        { orderNumber: { contains: search, mode: 'insensitive' } },
        { user: { name: { contains: search, mode: 'insensitive' } } },
        { user: { email: { contains: search, mode: 'insensitive' } } },
        { document: { originalName: { contains: search, mode: 'insensitive' } } },
      ];
    }

    // Dynamic sorting
    let orderBy = { createdAt: 'desc' };
    if (sortBy === 'created_asc') {
      orderBy = { createdAt: 'asc' };
    } else if (sortBy === 'updated_desc') {
      orderBy = { updatedAt: 'desc' };
    } else if (sortBy === 'amount_desc') {
      orderBy = { totalAmount: 'desc' };
    } else if (sortBy === 'amount_asc') {
      orderBy = { totalAmount: 'asc' };
    } else if (sortBy === 'pages_desc') {
      orderBy = { totalPages: 'desc' };
    } else if (sortBy === 'pages_asc') {
      orderBy = { totalPages: 'asc' };
    } else if (sortBy === 'status_asc') {
      orderBy = { orderStatus: 'asc' };
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
        orderBy,
      }),
      prisma.order.count({ where }),
    ]);

    // Fetch operator details for printed_by_id
    const operatorIds = orders.map((o) => o.printed_by_id || o.printedById).filter(Boolean);
    let operatorMap = {};
    if (operatorIds.length > 0) {
      try {
        const operators = await prisma.user.findMany({
          where: { id: { in: operatorIds } },
          select: { id: true, name: true, email: true },
        });
        operatorMap = Object.fromEntries(operators.map((op) => [op.id, op]));
      } catch (err) {
        console.error('Operator lookup error:', err);
      }
    }

    const enrichedOrders = orders.map((o) => {
      const pId = o.printed_by_id || o.printedById;
      return {
        ...o,
        printedBy: pId ? operatorMap[pId] || { id: pId, name: `Operator #${pId}` } : null,
      };
    });

    res.json({
      orders: enrichedOrders,
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
 * Admin / Operator: Update order status
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

    const now = new Date();
    const isPrintTransition = orderStatus === 'PRINTED' || orderStatus === 'DELIVERED';

    if (isPrintTransition) {
      await prisma.$executeRawUnsafe(
        'UPDATE orders SET order_status = $1::"OrderStatus", printed_by_id = COALESCE(printed_by_id, $2), printed_at = COALESCE(printed_at, $3), updated_at = $3 WHERE id = $4',
        orderStatus,
        req.user.id,
        now,
        id
      );
    } else {
      await prisma.$executeRawUnsafe(
        'UPDATE orders SET order_status = $1::"OrderStatus", updated_at = $2 WHERE id = $3',
        orderStatus,
        now,
        id
      );
    }

    const updated = await prisma.order.findUnique({
      where: { id },
      include: {
        document: true,
        user: { select: { id: true, name: true, email: true } },
      },
    });

    // Update document status if printed
    if (orderStatus === 'PRINTED' || orderStatus === 'DELIVERED') {
      if (updated.documentId) {
        await prisma.document.update({
          where: { id: updated.documentId },
          data: { status: 'PRINTED' },
        });
      }
    }

    // Trigger notification and email to customer
    if (updated && updated.user) {
      createNotification({
        userId: updated.userId,
        title: `Order Status: ${orderStatus}`,
        message: `Your print order ${updated.orderNumber} is now marked as ${orderStatus}.`,
        type: 'ORDER',
        link: `/user/orders?track=${updated.orderNumber}`,
      }).catch(() => {});

      if (updated.user.email) {
        sendOrderStatusEmail({
          to: updated.user.email,
          name: updated.user.name,
          order: updated,
        }).catch(() => {});
      }
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
      prisma.user.count({ where: { role: 'USER' } }),
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
    const totalPagesPrinted = allOrdersForPages.reduce((sum, o) => sum + o.totalPages * (o.copies || 1), 0);

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
    res.status(500).json({ message: 'Failed to fetch admin stats' });
  }
}

/**
 * Submit or update optional UPI Reference (UTR) for an order
 * POST /api/orders/:id/submit-utr
 */
async function submitOrderUtr(req, res) {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ message: 'Invalid order ID' });

    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
    });

    if (!order) return res.status(404).json({ message: 'Order not found' });

    // Ensure user owns this order or is staff
    if (order.userId !== req.user.id && !STAFF_ROLES.includes(req.user.role)) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const { upiRefNumber } = req.body;
    const cleanUtr = upiRefNumber ? String(upiRefNumber).trim() : null;

    const updated = await prisma.order.update({
      where: { id },
      data: {
        upiRefNumber: cleanUtr,
        paymentStatus: 'PENDING',
        paymentRejectReason: null,
      },
      include: {
        document: true,
        user: { select: { id: true, name: true, email: true } },
      },
    });

    // Notify admins of submitted / updated UTR
    notifyAdmins({
      title: 'Payment Verification Submitted',
      message: `Customer ${order.user?.name || 'User'} submitted UPI payment for order ${order.orderNumber} (₹${order.totalAmount}).${cleanUtr ? ` UTR: ${cleanUtr}` : ''}`,
      type: 'ORDER',
      link: '/admin/payments',
    }).catch(() => {});

    res.json({
      order: updated,
      message: 'Payment verification details submitted successfully',
    });
  } catch (err) {
    console.error('SubmitOrderUtr error:', err);
    res.status(500).json({ message: 'Failed to submit payment verification' });
  }
}

/**
 * Verify and approve payment for an order (Admin only)
 * POST /api/orders/:id/verify-payment
 */
async function verifyOrderPayment(req, res) {
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

    const updated = await prisma.order.update({
      where: { id },
      data: {
        paymentStatus: 'PAID',
        verifiedAt: new Date(),
        verifiedBy: req.user.id,
        paymentRejectReason: null,
      },
      include: {
        user: { select: { id: true, name: true, email: true } },
        document: true,
      },
    });

    // Generate QR token + cover page PDF
    const qrToken = crypto.randomUUID();
    const appUrl = process.env.APP_URL || 'https://inks.trackifyapp.co.in';
    const scanUrl = `${appUrl}/scan/${qrToken}`;

    try {
      const coverBuffer = await generateCoverPage(
        { ...updated, document: updated.document },
        updated.user,
        scanUrl
      );
      const coverFileName = `cover-${parseInt(updated.id)}.pdf`;
      const coverPath = path.normalize(path.resolve(UPLOADS_DIR, coverFileName));
      if (coverPath.startsWith(UPLOADS_DIR)) {
        fs.writeFileSync(coverPath, coverBuffer);
      }

      await prisma.order.update({
        where: { id: updated.id },
        data: { qrToken },
      });
    } catch (coverErr) {
      console.error('Cover page generation failed (non-fatal):', coverErr.message);
    }

    // Dispatch Official Tax Invoice PDF email to customer
    if (updated.user && updated.user.email) {
      sendPaymentInvoiceEmail({
        to: updated.user.email,
        name: updated.user.name,
        order: {
          ...updated,
          document: updated.document,
        },
      }).catch((err) => console.error('Failed to send invoice email:', err.message));
    }

    // In-app notification to customer
    createNotification({
      userId: updated.userId,
      title: 'Payment Verified & Confirmed',
      message: `Your payment of ₹${updated.totalAmount} for order ${updated.orderNumber} has been verified and confirmed! An invoice PDF has been sent to your email.`,
      type: 'ORDER',
      link: `/user/orders?track=${updated.orderNumber}`,
    }).catch(() => {});

    res.json({
      order: updated,
      message: `Payment for order ${updated.orderNumber} verified and approved successfully`,
    });
  } catch (err) {
    console.error('VerifyOrderPayment error:', err);
    res.status(500).json({ message: 'Failed to verify payment' });
  }
}

/**
 * Reject / Decline unverified payment and trigger reinitiate email (Admin only)
 * POST /api/orders/:id/reject-payment
 */
async function rejectOrderPayment(req, res) {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ message: 'Invalid order ID' });

    const { reason } = req.body;
    const cleanReason = (reason || 'Payment could not be verified in the merchant account').trim();

    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, name: true, email: true } },
        document: true,
      },
    });

    if (!order) return res.status(404).json({ message: 'Order not found' });

    const updated = await prisma.order.update({
      where: { id },
      data: {
        paymentStatus: 'FAILED',
        paymentRejectReason: cleanReason,
      },
      include: {
        user: { select: { id: true, name: true, email: true } },
        document: true,
      },
    });

    // Trigger Reinitiate Payment Email to customer
    if (updated.user && updated.user.email) {
      sendPaymentFailedReinitiateEmail({
        to: updated.user.email,
        name: updated.user.name,
        order: updated,
        reason: cleanReason,
      }).catch((err) => console.error('Failed to send reinitiate email:', err.message));
    }

    // In-app notification to customer
    createNotification({
      userId: updated.userId,
      title: 'Payment Verification Failed',
      message: `Payment for order ${updated.orderNumber} could not be verified (${cleanReason}). Click to reinitiate payment.`,
      type: 'ORDER',
      link: `/user/pay/${updated.id}`,
    }).catch(() => {});

    res.json({
      order: updated,
      message: `Payment for order ${updated.orderNumber} rejected. Reinitiate payment email dispatched to customer.`,
    });
  } catch (err) {
    console.error('RejectOrderPayment error:', err);
    res.status(500).json({ message: 'Failed to reject payment' });
  }
}

/**
 * Admin: Get Payment Verifications & Metrics
 * GET /api/orders/admin/payments
 */
async function getAdminPayments(req, res) {
  try {
    const pricing = await getPricingRules();

    const [pending, verified, rejected, totalRevenueRes] = await Promise.all([
      prisma.order.findMany({
        where: { paymentStatus: 'PENDING' },
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { id: true, name: true, email: true } },
          document: { select: { originalName: true, fileSize: true } },
        },
      }),
      prisma.order.findMany({
        where: { paymentStatus: 'PAID' },
        take: 50,
        orderBy: { updatedAt: 'desc' },
        include: {
          user: { select: { id: true, name: true, email: true } },
          document: { select: { originalName: true } },
        },
      }),
      prisma.order.findMany({
        where: { paymentStatus: 'FAILED' },
        take: 30,
        orderBy: { updatedAt: 'desc' },
        include: {
          user: { select: { id: true, name: true, email: true } },
          document: { select: { originalName: true } },
        },
      }),
      prisma.order.aggregate({
        _sum: { totalAmount: true },
        where: { paymentStatus: 'PAID' },
      }),
    ]);

    const pendingTotalAmount = pending.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
    const verifiedTotalAmount = totalRevenueRes._sum.totalAmount || 0;

    res.json({
      pending,
      verified,
      rejected,
      stats: {
        pendingCount: pending.length,
        pendingTotalAmount: parseFloat(pendingTotalAmount.toFixed(2)),
        verifiedCount: verified.length,
        verifiedTotalAmount: parseFloat(verifiedTotalAmount.toFixed(2)),
        rejectedCount: rejected.length,
      },
      merchantUpi: {
        merchantUpiId: pricing.merchantUpiId || 'trackify@icici',
        merchantName: pricing.merchantName || 'Inks by Trackify',
        autoApprovePayments: Boolean(pricing.autoApprovePayments),
      },
    });
  } catch (err) {
    console.error('GetAdminPayments error:', err);
    res.status(500).json({ message: 'Failed to fetch payment verifications' });
  }
}

/**
 * Download itemized PDF invoice for an order
 * GET /api/orders/:id/invoice
 */
async function downloadOrderInvoice(req, res) {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ message: 'Invalid order ID' });

    if (req.query.type === 'batch') {
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

      if (batch) {
        if (!STAFF_ROLES.includes(req.user.role) && batch.userId !== req.user.id) {
          return res.status(403).json({ message: 'Access denied' });
        }
        const pdfBuffer = await generateInvoicePdfBuffer(batch, batch.user);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="Invoice-${batch.batchNumber}.pdf"`);
        return res.send(pdfBuffer);
      }
    }

    let order = await prisma.order.findUnique({
      where: { id },
      include: {
        document: true,
        user: { select: { id: true, name: true, email: true } },
        batchOrder: {
          include: {
            orders: {
              include: {
                document: { select: { id: true, originalName: true, mimeType: true, fileSize: true } },
              },
            },
            user: { select: { id: true, name: true, email: true } },
          },
        },
      },
    });

    if (!order) {
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

      if (batch) {
        if (!STAFF_ROLES.includes(req.user.role) && batch.userId !== req.user.id) {
          return res.status(403).json({ message: 'Access denied' });
        }
        const pdfBuffer = await generateInvoicePdfBuffer(batch, batch.user);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="Invoice-${batch.batchNumber}.pdf"`);
        return res.send(pdfBuffer);
      }

      return res.status(404).json({ message: 'Order not found' });
    }

    if (!STAFF_ROLES.includes(req.user.role) && order.userId !== req.user.id) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const targetData = order.batchOrder && order.batchOrder.orders?.length > 0 ? order.batchOrder : order;
    const pdfBuffer = await generateInvoicePdfBuffer(targetData, order.user);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="Invoice-${targetData.batchNumber || order.orderNumber}.pdf"`);
    res.send(pdfBuffer);
  } catch (err) {
    console.error('DownloadOrderInvoice error:', err);
    res.status(500).json({ message: 'Failed to generate invoice PDF' });
  }
}

/**
 * Printer Operator Statistics: Operational print queue metrics, total pages printed,
 * personal operator metrics, mode distributions, with ZERO financial figures.
 * GET /api/orders/printer-stats
 */
async function getPrinterOrderStats(req, res) {
  try {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const operatorId = req.user.id;

    const [
      unprintedOrders,
      processingOrders,
      printedOrdersToday,
      allPrintedOrders,
      totalOrdersToday,
      rawOrdersWithOperator,
      recentPrintedList,
    ] = await Promise.all([
      prisma.order.count({ where: { orderStatus: { in: ['RECEIVED', 'PROCESSING'] } } }),
      prisma.order.count({ where: { orderStatus: 'PROCESSING' } }),
      prisma.order.findMany({
        where: {
          orderStatus: { in: ['PRINTED', 'DELIVERED'] },
          updatedAt: { gte: startOfToday },
        },
        select: { id: true, totalPages: true, copies: true, colorMode: true, paperSize: true, binding: true },
      }),
      prisma.order.findMany({
        where: {
          orderStatus: { in: ['PRINTED', 'DELIVERED'] },
        },
        select: { id: true, totalPages: true, copies: true, colorMode: true, paperSize: true, binding: true },
      }),
      prisma.order.count({ where: { createdAt: { gte: startOfToday } } }),
      prisma.$queryRawUnsafe(`
        SELECT id, total_pages, copies, color_mode, paper_size, binding, printed_by_id, printed_at, updated_at
        FROM orders
        WHERE order_status IN ('PRINTED', 'DELIVERED') AND printed_by_id = $1
      `, operatorId).catch(() => []),
      prisma.order.findMany({
        where: { orderStatus: { in: ['PRINTED', 'DELIVERED'] } },
        take: 8,
        orderBy: { updatedAt: 'desc' },
        include: {
          document: { select: { id: true, originalName: true, mimeType: true } },
          user: { select: { id: true, name: true } },
        },
      }),
    ]);

    const totalPagesPrintedToday = printedOrdersToday.reduce((sum, o) => sum + (o.totalPages || 1) * (o.copies || 1), 0);
    const totalPagesPrintedAllTime = allPrintedOrders.reduce((sum, o) => sum + (o.totalPages || 1) * (o.copies || 1), 0);

    const colorPagesAllTime = allPrintedOrders.filter(o => o.colorMode === 'COLOR').reduce((sum, o) => sum + (o.totalPages || 1) * (o.copies || 1), 0);
    const bwPagesAllTime = allPrintedOrders.filter(o => o.colorMode === 'BW').reduce((sum, o) => sum + (o.totalPages || 1) * (o.copies || 1), 0);

    const colorPagesToday = printedOrdersToday.filter(o => o.colorMode === 'COLOR').reduce((sum, o) => sum + (o.totalPages || 1) * (o.copies || 1), 0);
    const bwPagesToday = printedOrdersToday.filter(o => o.colorMode === 'BW').reduce((sum, o) => sum + (o.totalPages || 1) * (o.copies || 1), 0);

    const a4Jobs = allPrintedOrders.filter(o => o.paperSize === 'A4').length;
    const a3Jobs = allPrintedOrders.filter(o => o.paperSize === 'A3').length;
    const boundJobs = allPrintedOrders.filter(o => o.binding && o.binding !== 'none').length;

    // Operator Personal Attribution
    const myOrders = Array.isArray(rawOrdersWithOperator) ? rawOrdersWithOperator : [];
    const myOrdersToday = myOrders.filter(o => new Date(o.printed_at || o.updated_at) >= startOfToday);
    const mySheetsToday = myOrdersToday.reduce((sum, o) => sum + (o.total_pages || 1) * (o.copies || 1), 0);
    const mySheetsAllTime = myOrders.reduce((sum, o) => sum + (o.total_pages || 1) * (o.copies || 1), 0);

    res.json({
      unprintedCount: unprintedOrders,
      processingCount: processingOrders,
      printedTodayCount: printedOrdersToday.length,
      totalOrdersToday,
      totalPagesPrintedToday,
      totalPagesPrintedAllTime,
      colorPagesToday,
      bwPagesToday,
      colorPagesAllTime,
      bwPagesAllTime,
      a4Jobs,
      a3Jobs,
      boundJobs,
      recentPrintedList,
      personalStats: {
        operatorName: req.user.name,
        operatorEmail: req.user.email,
        sheetsPrintedToday: mySheetsToday,
        sheetsPrintedAllTime: mySheetsAllTime,
        ordersPrintedToday: myOrdersToday.length,
        ordersPrintedAllTime: myOrders.length,
      },
    });
  } catch (err) {
    console.error('GetPrinterOrderStats error:', err);
    res.status(500).json({ message: 'Failed to fetch printer statistics' });
  }
}

/**
 * Admin: Get comprehensive Printer Stations, Operators & Activity Status
 * GET /api/admin/printers/status
 */
async function getAdminPrinterStationStatus(req, res) {
  try {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // 1. Find all staff with PRINTER_ADMIN and ADMIN role
    const operators = await prisma.user.findMany({
      where: { role: { in: ['PRINTER_ADMIN', 'ADMIN'] } },
      select: { id: true, name: true, email: true, role: true, isActive: true, createdAt: true, updatedAt: true },
      orderBy: { role: 'asc' },
    });

    // 2. Fetch all printed orders from raw SQL with printed_by_id
    const rawPrintedOrders = await prisma.$queryRawUnsafe(`
      SELECT o.id, o.order_number, o.total_pages, o.copies, o.color_mode, o.paper_size, 
             o.binding, o.order_status, o.created_at, o.updated_at, o.printed_at, o.printed_by_id,
             d.original_name as doc_name, d.mime_type as doc_mime,
             u.name as customer_name
      FROM orders o
      LEFT JOIN documents d ON o.document_id = d.id
      LEFT JOIN users u ON o.user_id = u.id
      WHERE o.order_status IN ('PRINTED', 'DELIVERED')
      ORDER BY o.updated_at DESC
    `).catch(() => []);

    const safeOrders = Array.isArray(rawPrintedOrders) ? rawPrintedOrders : [];

    // 3. Aggregate performance by operator
    const operatorStats = operators.map((op) => {
      const opOrders = safeOrders.filter((o) => o.printed_by_id === op.id);
      const opOrdersToday = opOrders.filter((o) => new Date(o.printed_at || o.updated_at) >= startOfToday);

      const sheetsAllTime = opOrders.reduce((sum, o) => sum + (o.total_pages || 1) * (o.copies || 1), 0);
      const sheetsToday = opOrdersToday.reduce((sum, o) => sum + (o.total_pages || 1) * (o.copies || 1), 0);
      const colorSheets = opOrders.filter((o) => o.color_mode === 'COLOR').reduce((sum, o) => sum + (o.total_pages || 1) * (o.copies || 1), 0);
      const bwSheets = sheetsAllTime - colorSheets;

      const lastOrder = opOrders[0];

      return {
        operator: op,
        ordersCompletedAllTime: opOrders.length,
        ordersCompletedToday: opOrdersToday.length,
        sheetsPrintedAllTime: sheetsAllTime,
        sheetsPrintedToday: sheetsToday,
        colorSheets,
        bwSheets,
        lastPrintedAt: lastOrder ? (lastOrder.printed_at || lastOrder.updated_at) : null,
      };
    });

    // 4. Overall queue counts
    const [unprintedCount, processingCount, totalOrdersCount] = await Promise.all([
      prisma.order.count({ where: { orderStatus: { in: ['RECEIVED', 'PROCESSING'] } } }),
      prisma.order.count({ where: { orderStatus: 'PROCESSING' } }),
      prisma.order.count(),
    ]);

    const totalSheetsToday = safeOrders
      .filter((o) => new Date(o.printed_at || o.updated_at) >= startOfToday)
      .reduce((sum, o) => sum + (o.total_pages || 1) * (o.copies || 1), 0);

    const totalSheetsAllTime = safeOrders.reduce((sum, o) => sum + (o.total_pages || 1) * (o.copies || 1), 0);

    res.json({
      operators: operatorStats,
      unprintedCount,
      processingCount,
      totalOrdersCount,
      totalSheetsToday,
      totalSheetsAllTime,
      recentPrintedLogs: safeOrders.slice(0, 15).map((o) => {
        const op = operators.find((op) => op.id === o.printed_by_id);
        return {
          id: o.id,
          orderNumber: o.order_number,
          documentName: o.doc_name || 'Document',
          mimeType: o.doc_mime,
          customerName: o.customer_name || 'Customer',
          colorMode: o.color_mode,
          paperSize: o.paper_size,
          sheets: (o.total_pages || 1) * (o.copies || 1),
          copies: o.copies,
          printedAt: o.printed_at || o.updated_at,
          operatorName: op ? op.name : (o.printed_by_id ? `Staff #${o.printed_by_id}` : 'Store Dispatch'),
          operatorEmail: op ? op.email : null,
        };
      }),
    });
  } catch (err) {
    console.error('GetAdminPrinterStationStatus error:', err);
    res.status(500).json({ message: 'Failed to fetch printer station status' });
  }
}

module.exports = {
  calculateOrderBreakdown,
  calculatePrice,
  createOrder,
  getUserOrders,
  getOrderById,
  trackOrderByNumber,
  getAdminOrders,
  updateOrderStatus,
  getAdminOrderStats,
  getPrinterOrderStats,
  getAdminPrinterStationStatus,
  downloadOrderInvoice,
  submitOrderUtr,
  verifyOrderPayment,
  rejectOrderPayment,
  getAdminPayments,
};
