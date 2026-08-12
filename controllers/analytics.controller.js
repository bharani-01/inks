const prisma = require('../config/db');

/**
 * Helper: parse date range from query params
 */
function parseDateRange(query) {
  const now = new Date();
  let start, end = now;

  switch (query.range) {
    case '7d':
      start = new Date(now.getTime() - 7 * 86400000);
      break;
    case '30d':
      start = new Date(now.getTime() - 30 * 86400000);
      break;
    case '90d':
      start = new Date(now.getTime() - 90 * 86400000);
      break;
    case '1y':
      start = new Date(now.getTime() - 365 * 86400000);
      break;
    default:
      if (query.start) {
        start = new Date(query.start);
      } else {
        start = new Date(now.getTime() - 30 * 86400000);
      }
      if (query.end) {
        end = new Date(query.end);
      }
  }

  return { start, end };
}

/**
 * GET /api/analytics/revenue?range=30d&period=daily
 * Returns time-series revenue data
 */
async function getRevenue(req, res) {
  try {
    const { start, end } = parseDateRange(req.query);
    const period = req.query.period || 'daily'; // daily | weekly | monthly

    const orders = await prisma.order.findMany({
      where: {
        paymentStatus: 'PAID',
        createdAt: { gte: start, lte: end },
      },
      select: { totalAmount: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    });

    // Group by period
    const buckets = {};
    for (const o of orders) {
      const d = new Date(o.createdAt);
      let key;
      if (period === 'monthly') {
        key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      } else if (period === 'weekly') {
        const weekStart = new Date(d);
        weekStart.setDate(d.getDate() - d.getDay());
        key = weekStart.toISOString().slice(0, 10);
      } else {
        key = d.toISOString().slice(0, 10);
      }
      if (!buckets[key]) buckets[key] = { date: key, revenue: 0, orders: 0 };
      buckets[key].revenue += o.totalAmount;
      buckets[key].orders += 1;
    }

    const data = Object.values(buckets).sort((a, b) => a.date.localeCompare(b.date));

    // Simple trend: linear regression slope
    let trend = 0;
    if (data.length >= 2) {
      const n = data.length;
      const sumX = data.reduce((s, _, i) => s + i, 0);
      const sumY = data.reduce((s, d) => s + d.revenue, 0);
      const sumXY = data.reduce((s, d, i) => s + i * d.revenue, 0);
      const sumX2 = data.reduce((s, _, i) => s + i * i, 0);
      trend = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    }

    const totalRevenue = orders.reduce((s, o) => s + o.totalAmount, 0);

    res.json({ data, totalRevenue: Math.round(totalRevenue * 100) / 100, trend: Math.round(trend * 100) / 100, period });
  } catch (err) {
    console.error('Analytics revenue error:', err);
    res.status(500).json({ message: 'Failed to fetch revenue analytics' });
  }
}

/**
 * GET /api/analytics/orders-heatmap?range=30d
 * Returns 7x24 matrix of order counts (day-of-week x hour)
 */
async function getOrdersHeatmap(req, res) {
  try {
    const { start, end } = parseDateRange(req.query);

    const orders = await prisma.order.findMany({
      where: { createdAt: { gte: start, lte: end } },
      select: { createdAt: true },
    });

    // 7 days x 24 hours grid
    const grid = Array.from({ length: 7 }, () => Array(24).fill(0));
    for (const o of orders) {
      const d = new Date(o.createdAt);
      grid[d.getDay()][d.getHours()] += 1;
    }

    const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const heatmap = [];
    for (let day = 0; day < 7; day++) {
      for (let hour = 0; hour < 24; hour++) {
        heatmap.push({ day: dayLabels[day], dayIndex: day, hour, count: grid[day][hour] });
      }
    }

    res.json({ heatmap, totalOrders: orders.length });
  } catch (err) {
    console.error('Analytics heatmap error:', err);
    res.status(500).json({ message: 'Failed to fetch order heatmap' });
  }
}

/**
 * GET /api/analytics/user-funnel
 * Returns funnel: registered → first order → repeat
 */
async function getUserFunnel(req, res) {
  try {
    const totalRegistered = await prisma.user.count({ where: { role: 'USER' } });

    // Users who placed at least 1 order
    const usersWithOrders = await prisma.order.groupBy({
      by: ['userId'],
      _count: { id: true },
    });

    const firstOrderUsers = usersWithOrders.length;
    const repeatUsers = usersWithOrders.filter(u => u._count.id >= 2).length;
    const powerUsers = usersWithOrders.filter(u => u._count.id >= 5).length;

    res.json({
      funnel: [
        { stage: 'Registered', count: totalRegistered, percent: 100 },
        { stage: 'First Order', count: firstOrderUsers, percent: totalRegistered > 0 ? Math.round((firstOrderUsers / totalRegistered) * 100) : 0 },
        { stage: 'Repeat (2+)', count: repeatUsers, percent: totalRegistered > 0 ? Math.round((repeatUsers / totalRegistered) * 100) : 0 },
        { stage: 'Power (5+)', count: powerUsers, percent: totalRegistered > 0 ? Math.round((powerUsers / totalRegistered) * 100) : 0 },
      ],
    });
  } catch (err) {
    console.error('Analytics funnel error:', err);
    res.status(500).json({ message: 'Failed to fetch user funnel' });
  }
}

/**
 * GET /api/analytics/top-documents?limit=10
 */
async function getTopDocuments(req, res) {
  try {
    const limit = Math.min(20, Math.max(1, parseInt(req.query.limit) || 10));

    const docs = await prisma.order.groupBy({
      by: ['documentId'],
      _count: { id: true },
      _sum: { totalAmount: true },
      orderBy: { _count: { id: 'desc' } },
      take: limit,
    });

    // Fetch document names
    const docIds = docs.map(d => d.documentId);
    const docDetails = await prisma.document.findMany({
      where: { id: { in: docIds } },
      select: { id: true, originalName: true, mimeType: true },
    });
    const docMap = Object.fromEntries(docDetails.map(d => [d.id, d]));

    const topDocs = docs.map(d => ({
      documentId: d.documentId,
      name: docMap[d.documentId]?.originalName || 'Deleted Document',
      mimeType: docMap[d.documentId]?.mimeType || '',
      orderCount: d._count.id,
      totalRevenue: Math.round((d._sum.totalAmount || 0) * 100) / 100,
    }));

    res.json({ topDocuments: topDocs });
  } catch (err) {
    console.error('Analytics top-documents error:', err);
    res.status(500).json({ message: 'Failed to fetch top documents' });
  }
}

/**
 * GET /api/analytics/coupon-roi
 */
async function getCouponRoi(req, res) {
  try {
    const coupons = await prisma.coupon.findMany({
      select: {
        id: true,
        code: true,
        discountType: true,
        discountValue: true,
        usedCount: true,
        isActive: true,
      },
    });

    // For each coupon, get total discount given and total revenue from orders using it
    const couponIds = coupons.map(c => c.id);
    const orderAggregates = await prisma.order.groupBy({
      by: ['couponId'],
      where: { couponId: { in: couponIds }, paymentStatus: 'PAID' },
      _sum: { totalAmount: true, discountAmount: true },
      _count: { id: true },
    });

    const aggMap = Object.fromEntries(orderAggregates.map(a => [a.couponId, a]));

    const roi = coupons.map(c => {
      const agg = aggMap[c.id];
      return {
        code: c.code,
        isActive: c.isActive,
        timesUsed: agg?._count?.id || 0,
        totalDiscount: Math.round((agg?._sum?.discountAmount || 0) * 100) / 100,
        totalRevenue: Math.round((agg?._sum?.totalAmount || 0) * 100) / 100,
        roi: agg?._sum?.discountAmount > 0
          ? Math.round(((agg._sum.totalAmount || 0) / agg._sum.discountAmount) * 100) / 100
          : 0,
      };
    });

    res.json({ couponRoi: roi });
  } catch (err) {
    console.error('Analytics coupon-roi error:', err);
    res.status(500).json({ message: 'Failed to fetch coupon ROI' });
  }
}

/**
 * GET /api/analytics/consumption?range=30d
 * Paper consumption and simple forecast
 */
async function getConsumption(req, res) {
  try {
    const { start, end } = parseDateRange(req.query);

    const orders = await prisma.order.findMany({
      where: { createdAt: { gte: start, lte: end } },
      select: { totalPages: true, copies: true, colorMode: true, paperSize: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    });

    // Daily consumption
    const dailyMap = {};
    let totalBW = 0, totalColor = 0;
    const paperSizes = {};

    for (const o of orders) {
      const key = new Date(o.createdAt).toISOString().slice(0, 10);
      const pages = (o.totalPages || 1) * (o.copies || 1);
      if (!dailyMap[key]) dailyMap[key] = { date: key, pages: 0, bw: 0, color: 0 };
      dailyMap[key].pages += pages;
      if (o.colorMode === 'COLOR') {
        dailyMap[key].color += pages;
        totalColor += pages;
      } else {
        dailyMap[key].bw += pages;
        totalBW += pages;
      }
      paperSizes[o.paperSize] = (paperSizes[o.paperSize] || 0) + pages;
    }

    const dailyData = Object.values(dailyMap).sort((a, b) => a.date.localeCompare(b.date));

    // Simple forecast: average daily consumption * 7 days
    const avgDaily = dailyData.length > 0
      ? dailyData.reduce((s, d) => s + d.pages, 0) / dailyData.length
      : 0;

    // Generate 7-day forecast
    const forecast = [];
    if (dailyData.length > 0) {
      const lastDate = new Date(dailyData[dailyData.length - 1].date);
      for (let i = 1; i <= 7; i++) {
        const fd = new Date(lastDate.getTime() + i * 86400000);
        forecast.push({
          date: fd.toISOString().slice(0, 10),
          pages: Math.round(avgDaily),
          isForecast: true,
        });
      }
    }

    res.json({
      dailyData,
      forecast,
      totalPages: totalBW + totalColor,
      totalBW,
      totalColor,
      avgDaily: Math.round(avgDaily),
      paperSizes,
    });
  } catch (err) {
    console.error('Analytics consumption error:', err);
    res.status(500).json({ message: 'Failed to fetch consumption data' });
  }
}

/**
 * GET /api/analytics/export?report=revenue|orders|users&format=csv
 */
async function exportReport(req, res) {
  try {
    const { report = 'revenue', format = 'csv' } = req.query;
    const { start, end } = parseDateRange(req.query);

    let rows = [];
    let headers = [];

    if (report === 'revenue') {
      headers = ['Date', 'Order Number', 'User', 'Amount', 'Payment Status', 'Color Mode', 'Copies', 'Pages'];
      const orders = await prisma.order.findMany({
        where: { createdAt: { gte: start, lte: end } },
        include: { user: { select: { name: true, email: true } } },
        orderBy: { createdAt: 'desc' },
      });
      rows = orders.map(o => [
        new Date(o.createdAt).toISOString().slice(0, 10),
        o.orderNumber,
        o.user?.name || o.user?.email || '',
        o.totalAmount.toFixed(2),
        o.paymentStatus,
        o.colorMode,
        o.copies,
        o.totalPages,
      ]);
    } else if (report === 'orders') {
      headers = ['Order Number', 'Date', 'User', 'Document', 'Status', 'Payment', 'Amount', 'Discount', 'Color', 'Paper', 'Sides', 'Copies', 'Pages', 'Binding'];
      const orders = await prisma.order.findMany({
        where: { createdAt: { gte: start, lte: end } },
        include: {
          user: { select: { name: true } },
          document: { select: { originalName: true } },
        },
        orderBy: { createdAt: 'desc' },
      });
      rows = orders.map(o => [
        o.orderNumber,
        new Date(o.createdAt).toISOString().slice(0, 10),
        o.user?.name || '',
        o.document?.originalName || '',
        o.orderStatus,
        o.paymentStatus,
        o.totalAmount.toFixed(2),
        o.discountAmount.toFixed(2),
        o.colorMode,
        o.paperSize,
        o.sides,
        o.copies,
        o.totalPages,
        o.binding,
      ]);
    } else if (report === 'users') {
      headers = ['Name', 'Email', 'Phone', 'Role', 'Active', 'Registered', 'Total Orders', 'Total Spent'];
      const users = await prisma.user.findMany({
        select: {
          name: true, email: true, phone: true, role: true, isActive: true, createdAt: true,
          orders: { select: { totalAmount: true, paymentStatus: true } },
        },
        orderBy: { createdAt: 'desc' },
      });
      rows = users.map(u => {
        const paidOrders = u.orders.filter(o => o.paymentStatus === 'PAID');
        return [
          u.name,
          u.email,
          u.phone || '',
          u.role,
          u.isActive ? 'Yes' : 'No',
          new Date(u.createdAt).toISOString().slice(0, 10),
          paidOrders.length,
          paidOrders.reduce((s, o) => s + o.totalAmount, 0).toFixed(2),
        ];
      });
    }

    // Escape CSV value
    function csvEscape(val) {
      const str = String(val ?? '');
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    }

    const csvContent = [
      headers.map(csvEscape).join(','),
      ...rows.map(r => r.map(csvEscape).join(',')),
    ].join('\n');

    const filename = `inks-${report}-${new Date().toISOString().slice(0, 10)}.csv`;
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csvContent);
  } catch (err) {
    console.error('Analytics export error:', err);
    res.status(500).json({ message: 'Failed to export report' });
  }
}

module.exports = {
  getRevenue,
  getOrdersHeatmap,
  getUserFunnel,
  getTopDocuments,
  getCouponRoi,
  getConsumption,
  exportReport,
};
