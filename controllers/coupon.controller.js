const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { assertRedeemable } = require('../utils/coupon');

// GET /api/coupons - List all coupons (Admin)
async function listCoupons(req, res) {
  try {
    const coupons = await prisma.coupon.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { redemptions: true }
        }
      }
    });
    res.json(coupons);
  } catch (error) {
    console.error('List coupons error:', error);
    res.status(500).json({ error: 'Failed to list coupons' });
  }
}

// POST /api/coupons - Create a new coupon (Admin)
async function createCoupon(req, res) {
  try {
    const {
      code,
      description,
      discountType,
      discountValue,
      minOrderValue,
      maxDiscount,
      usageLimit,
      perUserLimit,
      expiresAt,
      isActive
    } = req.body;

    if (!code || !discountType || discountValue === undefined) {
      return res.status(400).json({ error: 'Code, discount type, and value are required' });
    }

    const upperCode = code.toUpperCase().trim();
    const existing = await prisma.coupon.findUnique({ where: { code: upperCode } });
    if (existing) {
      return res.status(400).json({ error: 'Coupon code already exists' });
    }

    const coupon = await prisma.coupon.create({
      data: {
        code: upperCode,
        description,
        discountType,
        discountValue: parseFloat(discountValue),
        minOrderValue: minOrderValue ? parseFloat(minOrderValue) : null,
        maxDiscount: maxDiscount ? parseFloat(maxDiscount) : null,
        usageLimit: usageLimit ? parseInt(usageLimit) : null,
        perUserLimit: perUserLimit ? parseInt(perUserLimit) : null,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        isActive: isActive !== undefined ? isActive : true
      }
    });

    res.status(201).json(coupon);
  } catch (error) {
    console.error('Create coupon error:', error);
    res.status(500).json({ error: 'Failed to create coupon' });
  }
}

// PUT /api/coupons/:id - Update coupon (Admin)
async function updateCoupon(req, res) {
  try {
    const id = parseInt(req.params.id);
    const updates = req.body;

    // Prevent updating the code to an existing one
    if (updates.code) {
      updates.code = updates.code.toUpperCase().trim();
      const existing = await prisma.coupon.findFirst({
        where: { code: updates.code, id: { not: id } }
      });
      if (existing) {
        return res.status(400).json({ error: 'Coupon code already in use' });
      }
    }

    // Format numbers and dates
    const data = { ...updates };
    if (data.discountValue !== undefined) data.discountValue = parseFloat(data.discountValue);
    if (data.minOrderValue !== undefined) data.minOrderValue = data.minOrderValue === null ? null : parseFloat(data.minOrderValue);
    if (data.maxDiscount !== undefined) data.maxDiscount = data.maxDiscount === null ? null : parseFloat(data.maxDiscount);
    if (data.usageLimit !== undefined) data.usageLimit = data.usageLimit === null ? null : parseInt(data.usageLimit);
    if (data.perUserLimit !== undefined) data.perUserLimit = data.perUserLimit === null ? null : parseInt(data.perUserLimit);
    if (data.expiresAt !== undefined) data.expiresAt = data.expiresAt === null ? null : new Date(data.expiresAt);

    const coupon = await prisma.coupon.update({
      where: { id },
      data
    });

    res.json(coupon);
  } catch (error) {
    console.error('Update coupon error:', error);
    res.status(500).json({ error: 'Failed to update coupon' });
  }
}

// DELETE /api/coupons/:id - Delete coupon (Admin)
async function deleteCoupon(req, res) {
  try {
    const id = parseInt(req.params.id);
    await prisma.coupon.delete({ where: { id } });
    res.json({ message: 'Coupon deleted' });
  } catch (error) {
    console.error('Delete coupon error:', error);
    res.status(500).json({ error: 'Failed to delete coupon' });
  }
}

// POST /api/coupons/validate - Validate coupon for user (Public/User)
async function validateCoupon(req, res) {
  try {
    const { code, subtotal } = req.body;
    if (!code) return res.status(400).json({ error: 'Coupon code required' });
    if (!subtotal) return res.status(400).json({ error: 'Subtotal required' });

    const coupon = await prisma.coupon.findUnique({
      where: { code: code.toUpperCase().trim() }
    });

    try {
      const discountAmount = await assertRedeemable(prisma, coupon, {
        userId: req.user.id,
        subtotal: parseFloat(subtotal)
      });
      
      res.json({
        valid: true,
        coupon,
        discountAmount
      });
    } catch (err) {
      if (err.status === 400) {
        return res.json({ valid: false, error: err.message });
      }
      throw err;
    }

  } catch (error) {
    console.error('Validate coupon error:', error);
    res.status(500).json({ error: 'Failed to validate coupon' });
  }
}

// GET /api/coupons/analytics - Comprehensive Coupon Analytics (Admin)
async function getCouponAnalytics(req, res) {
  try {
    const now = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [coupons, redemptions, totalOrdersCount, totalSystemRevenue] = await Promise.all([
      prisma.coupon.findMany({
        include: {
          _count: { select: { redemptions: true } }
        },
        orderBy: { createdAt: 'desc' }
      }),
      prisma.couponRedemption.findMany({
        include: {
          user: { select: { id: true, name: true, email: true } },
          order: {
            select: {
              id: true,
              orderNumber: true,
              subtotal: true,
              tax: true,
              totalAmount: true,
              orderStatus: true,
              paymentStatus: true,
              createdAt: true
            }
          },
          coupon: { select: { id: true, code: true, discountType: true, discountValue: true } }
        },
        orderBy: { createdAt: 'desc' }
      }),
      prisma.order.count(),
      prisma.order.aggregate({
        _sum: { totalAmount: true }
      })
    ]);

    // Overall summary metrics
    const totalRedemptions = redemptions.length;
    const totalDiscountGiven = redemptions.reduce((sum, r) => sum + (r.discountAmount || 0), 0);
    const totalRevenueFromCoupons = redemptions.reduce((sum, r) => sum + (r.order?.totalAmount || 0), 0);
    const totalSubtotalFromCoupons = redemptions.reduce((sum, r) => sum + (r.order?.subtotal || 0), 0);
    
    const uniqueUserSet = new Set(redemptions.map(r => r.userId));
    const uniqueUsersCount = uniqueUserSet.size;

    // Coupon status counts
    let activeCouponsCount = 0;
    let expiredCouponsCount = 0;
    let depletedCouponsCount = 0;
    let disabledCouponsCount = 0;

    coupons.forEach(c => {
      const isExpired = c.expiresAt && new Date(c.expiresAt) < now;
      const isDepleted = c.usageLimit && c.usedCount >= c.usageLimit;
      if (!c.isActive) {
        disabledCouponsCount++;
      } else if (isExpired) {
        expiredCouponsCount++;
      } else if (isDepleted) {
        depletedCouponsCount++;
      } else {
        activeCouponsCount++;
      }
    });

    // ROI Multiplier: Revenue generated per ₹1 of discount
    const roiMultiplier = totalDiscountGiven > 0 
      ? (totalRevenueFromCoupons / totalDiscountGiven).toFixed(2)
      : '0.00';

    // Average Discount per redemption
    const averageDiscount = totalRedemptions > 0 
      ? (totalDiscountGiven / totalRedemptions).toFixed(2)
      : '0.00';

    // Average Order Value with coupon
    const avgOrderValueWithCoupon = totalRedemptions > 0
      ? (totalRevenueFromCoupons / totalRedemptions).toFixed(2)
      : '0.00';

    // Coupon-level performance list
    const couponPerformanceMap = {};
    coupons.forEach(c => {
      couponPerformanceMap[c.id] = {
        id: c.id,
        code: c.code,
        description: c.description,
        discountType: c.discountType,
        discountValue: c.discountValue,
        minOrderValue: c.minOrderValue,
        maxDiscount: c.maxDiscount,
        usageLimit: c.usageLimit,
        perUserLimit: c.perUserLimit,
        usedCount: c.usedCount,
        expiresAt: c.expiresAt,
        isActive: c.isActive,
        createdAt: c.createdAt,
        totalRedemptions: 0,
        totalDiscount: 0,
        totalRevenue: 0,
        uniqueUsers: new Set()
      };
    });

    redemptions.forEach(r => {
      if (couponPerformanceMap[r.couponId]) {
        couponPerformanceMap[r.couponId].totalRedemptions++;
        couponPerformanceMap[r.couponId].totalDiscount += (r.discountAmount || 0);
        couponPerformanceMap[r.couponId].totalRevenue += (r.order?.totalAmount || 0);
        couponPerformanceMap[r.couponId].uniqueUsers.add(r.userId);
      }
    });

    const topCoupons = Object.values(couponPerformanceMap).map(c => ({
      ...c,
      uniqueUsersCount: c.uniqueUsers.size,
      uniqueUsers: undefined, // remove Set for JSON serialization
      usageRate: c.usageLimit ? Math.min(100, Math.round((c.usedCount / c.usageLimit) * 100)) : null,
      roi: c.totalDiscount > 0 ? (c.totalRevenue / c.totalDiscount).toFixed(2) : '0.00'
    })).sort((a, b) => b.totalRedemptions - a.totalRedemptions || b.totalRevenue - a.totalRevenue);

    // 30-Day Daily Timeline Chart Data
    const dailyMap = {};
    for (let i = 29; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateKey = d.toISOString().slice(0, 10);
      dailyMap[dateKey] = {
        date: dateKey,
        label: d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }),
        redemptions: 0,
        discount: 0,
        revenue: 0
      };
    }

    redemptions.forEach(r => {
      const dateKey = new Date(r.createdAt).toISOString().slice(0, 10);
      if (dailyMap[dateKey]) {
        dailyMap[dateKey].redemptions += 1;
        dailyMap[dateKey].discount += (r.discountAmount || 0);
        dailyMap[dateKey].revenue += (r.order?.totalAmount || 0);
      }
    });

    const timeline = Object.values(dailyMap);

    // Discount Type Breakdown (PERCENT vs FIXED)
    const typeDistribution = {
      PERCENT: { count: 0, redemptions: 0, discount: 0, revenue: 0 },
      FIXED: { count: 0, redemptions: 0, discount: 0, revenue: 0 }
    };

    coupons.forEach(c => {
      if (typeDistribution[c.discountType]) {
        typeDistribution[c.discountType].count++;
      }
    });

    redemptions.forEach(r => {
      const type = r.coupon?.discountType;
      if (type && typeDistribution[type]) {
        typeDistribution[type].redemptions++;
        typeDistribution[type].discount += (r.discountAmount || 0);
        typeDistribution[type].revenue += (r.order?.totalAmount || 0);
      }
    });

    res.json({
      summary: {
        totalCoupons: coupons.length,
        activeCoupons: activeCouponsCount,
        expiredCoupons: expiredCouponsCount,
        depletedCoupons: depletedCouponsCount,
        disabledCoupons: disabledCouponsCount,
        totalRedemptions,
        totalDiscountGiven: parseFloat(totalDiscountGiven.toFixed(2)),
        totalRevenueFromCoupons: parseFloat(totalRevenueFromCoupons.toFixed(2)),
        totalSubtotalFromCoupons: parseFloat(totalSubtotalFromCoupons.toFixed(2)),
        uniqueUsersCount,
        roiMultiplier: parseFloat(roiMultiplier),
        averageDiscount: parseFloat(averageDiscount),
        avgOrderValueWithCoupon: parseFloat(avgOrderValueWithCoupon),
        couponUsageOrderRate: totalOrdersCount > 0 
          ? parseFloat(((totalRedemptions / totalOrdersCount) * 100).toFixed(1)) 
          : 0,
        systemTotalRevenue: totalSystemRevenue._sum.totalAmount || 0
      },
      topCoupons,
      timeline,
      typeDistribution,
      recentRedemptions: redemptions.slice(0, 50)
    });
  } catch (error) {
    console.error('Get coupon analytics error:', error);
    res.status(500).json({ error: 'Failed to fetch coupon analytics' });
  }
}

// GET /api/coupons/:id/details - Single Coupon Detailed Drilldown (Admin)
async function getCouponDetails(req, res) {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid coupon ID' });

    const coupon = await prisma.coupon.findUnique({
      where: { id },
      include: {
        redemptions: {
          include: {
            user: { select: { id: true, name: true, email: true, createdAt: true } },
            order: {
              select: {
                id: true,
                orderNumber: true,
                subtotal: true,
                tax: true,
                totalAmount: true,
                orderStatus: true,
                paymentStatus: true,
                paymentMethod: true,
                createdAt: true,
                document: {
                  select: { originalName: true }
                }
              }
            }
          },
          orderBy: { createdAt: 'desc' }
        }
      }
    });

    if (!coupon) {
      return res.status(404).json({ error: 'Coupon not found' });
    }

    const redemptions = coupon.redemptions || [];
    const totalRedemptions = redemptions.length;
    const totalDiscountDisbursed = redemptions.reduce((sum, r) => sum + (r.discountAmount || 0), 0);
    const totalRevenueGenerated = redemptions.reduce((sum, r) => sum + (r.order?.totalAmount || 0), 0);
    const totalSubtotal = redemptions.reduce((sum, r) => sum + (r.order?.subtotal || 0), 0);

    // Group by user to show customer frequency and total savings
    const userSummaryMap = {};
    redemptions.forEach(r => {
      const u = r.user;
      if (!u) return;
      if (!userSummaryMap[u.id]) {
        userSummaryMap[u.id] = {
          user: u,
          redemptionsCount: 0,
          totalDiscount: 0,
          totalSpent: 0,
          firstRedeemedAt: r.createdAt,
          lastRedeemedAt: r.createdAt,
          orders: []
        };
      }
      userSummaryMap[u.id].redemptionsCount += 1;
      userSummaryMap[u.id].totalDiscount += (r.discountAmount || 0);
      userSummaryMap[u.id].totalSpent += (r.order?.totalAmount || 0);
      userSummaryMap[u.id].orders.push({
        orderId: r.order?.id,
        orderNumber: r.order?.orderNumber,
        discountAmount: r.discountAmount,
        totalAmount: r.order?.totalAmount,
        date: r.createdAt
      });
      if (new Date(r.createdAt) > new Date(userSummaryMap[u.id].lastRedeemedAt)) {
        userSummaryMap[u.id].lastRedeemedAt = r.createdAt;
      }
    });

    const usersSummary = Object.values(userSummaryMap).sort((a, b) => b.redemptionsCount - a.redemptionsCount);

    const now = new Date();
    const isExpired = coupon.expiresAt && new Date(coupon.expiresAt) < now;
    const isDepleted = coupon.usageLimit && coupon.usedCount >= coupon.usageLimit;
    let statusLabel = 'ACTIVE';
    if (!coupon.isActive) statusLabel = 'DISABLED';
    else if (isExpired) statusLabel = 'EXPIRED';
    else if (isDepleted) statusLabel = 'DEPLETED';

    res.json({
      coupon: {
        ...coupon,
        statusLabel,
        redemptions: undefined // avoid double sending
      },
      stats: {
        totalRedemptions,
        totalDiscountDisbursed: parseFloat(totalDiscountDisbursed.toFixed(2)),
        totalRevenueGenerated: parseFloat(totalRevenueGenerated.toFixed(2)),
        totalSubtotal: parseFloat(totalSubtotal.toFixed(2)),
        uniqueCustomersCount: usersSummary.length,
        averageDiscount: totalRedemptions > 0 ? parseFloat((totalDiscountDisbursed / totalRedemptions).toFixed(2)) : 0,
        averageOrderValue: totalRedemptions > 0 ? parseFloat((totalRevenueGenerated / totalRedemptions).toFixed(2)) : 0,
        roi: totalDiscountDisbursed > 0 ? parseFloat((totalRevenueGenerated / totalDiscountDisbursed).toFixed(2)) : 0,
        usageProgress: coupon.usageLimit ? Math.min(100, Math.round((coupon.usedCount / coupon.usageLimit) * 100)) : null
      },
      usersSummary,
      redemptions
    });
  } catch (error) {
    console.error('Get coupon details error:', error);
    res.status(500).json({ error: 'Failed to fetch coupon details' });
  }
}

module.exports = {
  listCoupons,
  createCoupon,
  updateCoupon,
  deleteCoupon,
  validateCoupon,
  getCouponAnalytics,
  getCouponDetails
};

