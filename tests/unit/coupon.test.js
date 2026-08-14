const { computeDiscount, assertRedeemable } = require('../../utils/coupon');

describe('Coupon Utility (utils/coupon.js)', () => {
  describe('computeDiscount()', () => {
    it('should return 0 if coupon is null or subtotal is <= 0', () => {
      expect(computeDiscount(null, 100)).toBe(0);
      expect(computeDiscount({ discountType: 'FIXED', discountValue: 50 }, 0)).toBe(0);
      expect(computeDiscount({ discountType: 'FIXED', discountValue: 50 }, -10)).toBe(0);
    });

    it('should compute percentage discount correctly', () => {
      const coupon = { discountType: 'PERCENT', discountValue: 15, maxDiscount: null };
      expect(computeDiscount(coupon, 200)).toBe(30);
    });

    it('should apply maxDiscount cap for percentage discounts', () => {
      const coupon = { discountType: 'PERCENT', discountValue: 50, maxDiscount: 40 };
      expect(computeDiscount(coupon, 100)).toBe(40);
    });

    it('should compute fixed discount correctly', () => {
      const coupon = { discountType: 'FIXED', discountValue: 25 };
      expect(computeDiscount(coupon, 100)).toBe(25);
    });

    it('should clamp discount to subtotal if discount exceeds subtotal', () => {
      const coupon = { discountType: 'FIXED', discountValue: 150 };
      expect(computeDiscount(coupon, 100)).toBe(100);
    });

    it('should round discount to 2 decimal places', () => {
      const coupon = { discountType: 'PERCENT', discountValue: 12.5, maxDiscount: null };
      expect(computeDiscount(coupon, 33.33)).toBe(4.17);
    });
  });

  describe('assertRedeemable()', () => {
    let mockPrisma;

    beforeEach(() => {
      mockPrisma = {
        couponRedemption: {
          count: jest.fn().mockResolvedValue(0),
        },
      };
    });

    it('should throw error if coupon is missing', async () => {
      await expect(assertRedeemable(mockPrisma, null, { userId: 1, subtotal: 100 }))
        .rejects.toThrow('Coupon not found');
    });

    it('should throw error if coupon is inactive', async () => {
      const coupon = { isActive: false };
      await expect(assertRedeemable(mockPrisma, coupon, { userId: 1, subtotal: 100 }))
        .rejects.toThrow('This coupon is no longer active.');
    });

    it('should throw error if coupon is expired', async () => {
      const coupon = {
        isActive: true,
        expiresAt: new Date(Date.now() - 10000),
      };
      await expect(assertRedeemable(mockPrisma, coupon, { userId: 1, subtotal: 100 }))
        .rejects.toThrow('This coupon has expired.');
    });

    it('should throw error if usedCount reaches usageLimit', async () => {
      const coupon = {
        isActive: true,
        usageLimit: 10,
        usedCount: 10,
      };
      await expect(assertRedeemable(mockPrisma, coupon, { userId: 1, subtotal: 100 }))
        .rejects.toThrow('This coupon has reached its maximum redemption limit.');
    });

    it('should throw error if subtotal is below minOrderValue', async () => {
      const coupon = {
        isActive: true,
        minOrderValue: 200,
      };
      await expect(assertRedeemable(mockPrisma, coupon, { userId: 1, subtotal: 150 }))
        .rejects.toThrow('Order subtotal must be at least ₹200.00 to use this coupon.');
    });

    it('should throw error if user has reached perUserLimit', async () => {
      const coupon = {
        id: 5,
        isActive: true,
        perUserLimit: 2,
      };
      mockPrisma.couponRedemption.count.mockResolvedValue(2);

      await expect(assertRedeemable(mockPrisma, coupon, { userId: 1, subtotal: 100 }))
        .rejects.toThrow('You have already reached the maximum usage limit for this coupon.');
    });

    it('should return computed discount if coupon is completely valid', async () => {
      const coupon = {
        id: 1,
        isActive: true,
        discountType: 'FIXED',
        discountValue: 20,
        usageLimit: 100,
        usedCount: 5,
        minOrderValue: 50,
        perUserLimit: 3,
      };
      mockPrisma.couponRedemption.count.mockResolvedValue(1);

      const discount = await assertRedeemable(mockPrisma, coupon, { userId: 1, subtotal: 100 });
      expect(discount).toBe(20);
    });
  });
});
