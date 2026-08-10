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

module.exports = {
  listCoupons,
  createCoupon,
  updateCoupon,
  deleteCoupon,
  validateCoupon
};
