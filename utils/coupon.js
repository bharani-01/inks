const { PrismaClient } = require('@prisma/client');

/**
 * Computes the discount for a given coupon and subtotal.
 * @param {Object} coupon - The coupon object from DB.
 * @param {number} subtotal - The order subtotal.
 * @returns {number} The calculated discount amount (clamped to max subtotal).
 */
function computeDiscount(coupon, subtotal) {
  if (!coupon || subtotal <= 0) return 0;

  let discount = 0;
  if (coupon.discountType === 'PERCENT') {
    discount = (subtotal * coupon.discountValue) / 100;
    if (coupon.maxDiscount !== null && discount > coupon.maxDiscount) {
      discount = coupon.maxDiscount;
    }
  } else if (coupon.discountType === 'FIXED') {
    discount = coupon.discountValue;
  }

  // Round to 2 decimals
  discount = Math.round(discount * 100) / 100;

  // Never discount more than the subtotal
  return Math.min(discount, subtotal);
}

/**
 * Validates if a coupon can be redeemed by a user for a specific subtotal.
 * Throws an Error with a 400 status if invalid.
 * @param {PrismaClient} prisma - Prisma instance.
 * @param {Object} coupon - The coupon object from DB.
 * @param {Object} options - { userId, subtotal }
 * @returns {Promise<number>} The computed discount amount.
 */
async function assertRedeemable(prisma, coupon, { userId, subtotal }) {
  if (!coupon) {
    const err = new Error('Coupon not found');
    err.status = 400;
    throw err;
  }

  if (!coupon.isActive) {
    const err = new Error('This coupon is no longer active.');
    err.status = 400;
    throw err;
  }

  if (coupon.expiresAt && new Date() > new Date(coupon.expiresAt)) {
    const err = new Error('This coupon has expired.');
    err.status = 400;
    throw err;
  }

  if (coupon.usageLimit !== null && coupon.usedCount >= coupon.usageLimit) {
    const err = new Error('This coupon has reached its maximum redemption limit.');
    err.status = 400;
    throw err;
  }

  if (coupon.minOrderValue !== null && subtotal < coupon.minOrderValue) {
    const err = new Error(`Order subtotal must be at least ₹${coupon.minOrderValue.toFixed(2)} to use this coupon.`);
    err.status = 400;
    throw err;
  }

  if (coupon.perUserLimit !== null) {
    const userRedemptionsCount = await prisma.couponRedemption.count({
      where: {
        couponId: coupon.id,
        userId: userId,
      },
    });

    if (userRedemptionsCount >= coupon.perUserLimit) {
      const err = new Error('You have already reached the maximum usage limit for this coupon.');
      err.status = 400;
      throw err;
    }
  }

  return computeDiscount(coupon, subtotal);
}

module.exports = {
  computeDiscount,
  assertRedeemable,
};
