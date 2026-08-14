const { calculateOrderBreakdown } = require('../../controllers/order.controller');

describe('Order Pricing Breakdown Unit Test Suite', () => {
  const defaultPricing = {
    bwRate: 2.0,
    colorRate: 10.0,
    duplexDiscount: 0.15,
    taxRate: 0.18,
    paperSizeMultipliers: {
      A4: 1.0,
      A3: 2.0,
      A5: 0.8,
      Letter: 1.1,
      Legal: 1.2,
    },
    bindingRates: {
      none: 0,
      staple: 10.0,
      spiral: 35.0,
      thermal: 50.0,
      hardcover: 120.0,
    },
  };

  describe('Black & White Printing Pricing', () => {
    it('should compute single-sided A4 B&W pricing correctly for 1 page', () => {
      const result = calculateOrderBreakdown(
        { colorMode: 'BW', paperSize: 'A4', sides: 'SINGLE', copies: 1, binding: 'none', totalPages: 1 },
        defaultPricing,
        0
      );

      expect(result.basePageRate).toBe(2.0);
      expect(result.effectivePageRate).toBe(2.0);
      expect(result.printCost).toBe(2.0);
      expect(result.bindingCost).toBe(0);
      expect(result.subtotal).toBe(2.0);
      expect(result.tax).toBe(0.36); // 2.0 * 0.18
      expect(result.totalAmount).toBe(2.36);
    });

    it('should compute single-sided A4 B&W pricing for multi-page document', () => {
      const result = calculateOrderBreakdown(
        { colorMode: 'BW', paperSize: 'A4', sides: 'SINGLE', copies: 1, binding: 'none', totalPages: 50 },
        defaultPricing,
        0
      );

      expect(result.printCost).toBe(100.0);
      expect(result.subtotal).toBe(100.0);
      expect(result.tax).toBe(18.0);
      expect(result.totalAmount).toBe(118.0);
    });

    it('should apply duplex (double-sided) 15% discount on page rate', () => {
      const result = calculateOrderBreakdown(
        { colorMode: 'BW', paperSize: 'A4', sides: 'DOUBLE', copies: 1, binding: 'none', totalPages: 10 },
        defaultPricing,
        0
      );

      // 2.0 * (1 - 0.15) = 1.70 per page
      expect(result.basePageRate).toBe(1.7);
      expect(result.printCost).toBe(17.0);
      expect(result.subtotal).toBe(17.0);
      expect(result.tax).toBe(3.06);
      expect(result.totalAmount).toBe(20.06);
    });

    it('should multiply print cost accurately for multiple copies', () => {
      const result = calculateOrderBreakdown(
        { colorMode: 'BW', paperSize: 'A4', sides: 'SINGLE', copies: 5, binding: 'none', totalPages: 10 },
        defaultPricing,
        0
      );

      // 2.0 * 10 pages * 5 copies = 100.0
      expect(result.printCost).toBe(100.0);
      expect(result.subtotal).toBe(100.0);
    });
  });

  describe('Color Printing Pricing', () => {
    it('should compute single-sided A4 Color pricing correctly', () => {
      const result = calculateOrderBreakdown(
        { colorMode: 'COLOR', paperSize: 'A4', sides: 'SINGLE', copies: 1, binding: 'none', totalPages: 5 },
        defaultPricing,
        0
      );

      expect(result.basePageRate).toBe(10.0);
      expect(result.printCost).toBe(50.0);
      expect(result.subtotal).toBe(50.0);
      expect(result.tax).toBe(9.0);
      expect(result.totalAmount).toBe(59.0);
    });

    it('should apply duplex discount to color printing rate', () => {
      const result = calculateOrderBreakdown(
        { colorMode: 'COLOR', paperSize: 'A4', sides: 'DOUBLE', copies: 2, binding: 'none', totalPages: 10 },
        defaultPricing,
        0
      );

      // 10.0 * 0.85 = 8.5 per page * 10 pages * 2 copies = 170.0
      expect(result.basePageRate).toBe(8.5);
      expect(result.printCost).toBe(170.0);
      expect(result.subtotal).toBe(170.0);
    });
  });

  describe('Paper Size Multipliers', () => {
    const sizes = [
      { size: 'A3', expectedMultiplier: 2.0, expectedPrintCost: 20.0 },
      { size: 'A5', expectedMultiplier: 0.8, expectedPrintCost: 8.0 },
      { size: 'Letter', expectedMultiplier: 1.1, expectedPrintCost: 11.0 },
      { size: 'Legal', expectedMultiplier: 1.2, expectedPrintCost: 12.0 },
    ];

    sizes.forEach(({ size, expectedMultiplier, expectedPrintCost }) => {
      it(`should scale pricing correctly for paper size ${size}`, () => {
        const result = calculateOrderBreakdown(
          { colorMode: 'BW', paperSize: size, sides: 'SINGLE', copies: 1, binding: 'none', totalPages: 5 },
          defaultPricing,
          0
        );

        expect(result.effectivePageRate).toBe(2.0 * expectedMultiplier);
        expect(result.printCost).toBe(expectedPrintCost);
      });
    });

    it('should default to 1.0 multiplier for unknown or invalid paper sizes', () => {
      const result = calculateOrderBreakdown(
        { colorMode: 'BW', paperSize: 'INVALID_SIZE', sides: 'SINGLE', copies: 1, binding: 'none', totalPages: 10 },
        defaultPricing,
        0
      );

      expect(result.effectivePageRate).toBe(2.0);
      expect(result.printCost).toBe(20.0);
    });
  });

  describe('Binding Cost Rates', () => {
    const bindings = [
      { type: 'staple', expectedCost: 10.0 },
      { type: 'spiral', expectedCost: 35.0 },
      { type: 'thermal', expectedCost: 50.0 },
      { type: 'hardcover', expectedCost: 120.0 },
    ];

    bindings.forEach(({ type, expectedCost }) => {
      it(`should apply correct binding rate for ${type}`, () => {
        const result = calculateOrderBreakdown(
          { colorMode: 'BW', paperSize: 'A4', sides: 'SINGLE', copies: 1, binding: type, totalPages: 10 },
          defaultPricing,
          0
        );

        expect(result.bindingCost).toBe(expectedCost);
        expect(result.subtotal).toBe(20.0 + expectedCost);
      });
    });

    it('should multiply binding cost by the number of copies', () => {
      const result = calculateOrderBreakdown(
        { colorMode: 'BW', paperSize: 'A4', sides: 'SINGLE', copies: 3, binding: 'spiral', totalPages: 10 },
        defaultPricing,
        0
      );

      // 35.0 * 3 copies = 105.0
      expect(result.bindingCost).toBe(105.0);
    });

    it('should default to 0 binding cost for unknown binding options', () => {
      const result = calculateOrderBreakdown(
        { colorMode: 'BW', paperSize: 'A4', sides: 'SINGLE', copies: 1, binding: 'unknown_binding', totalPages: 10 },
        defaultPricing,
        0
      );

      expect(result.bindingCost).toBe(0);
    });
  });

  describe('Discounts & Tax Calculation Edge Cases', () => {
    it('should calculate tax on taxable subtotal after applying coupon discount', () => {
      const result = calculateOrderBreakdown(
        { colorMode: 'BW', paperSize: 'A4', sides: 'SINGLE', copies: 1, binding: 'none', totalPages: 50 },
        defaultPricing,
        20.0 // ₹20 discount
      );

      // Subtotal = 100.0, Discount = 20.0 -> Taxable = 80.0
      // Tax = 80.0 * 0.18 = 14.40
      // Total = 80.0 + 14.40 = 94.40
      expect(result.subtotal).toBe(100.0);
      expect(result.discountAmount).toBe(20.0);
      expect(result.tax).toBe(14.4);
      expect(result.totalAmount).toBe(94.4);
    });

    it('should clamp taxable amount and total to 0 if discount exceeds subtotal', () => {
      const result = calculateOrderBreakdown(
        { colorMode: 'BW', paperSize: 'A4', sides: 'SINGLE', copies: 1, binding: 'none', totalPages: 10 },
        defaultPricing,
        50.0 // Discount > ₹20 subtotal
      );

      expect(result.subtotal).toBe(20.0);
      expect(result.tax).toBe(0);
      expect(result.totalAmount).toBe(0);
    });

    it('should handle custom tax rates accurately', () => {
      const customPricing = { ...defaultPricing, taxRate: 0.05 }; // 5% GST
      const result = calculateOrderBreakdown(
        { colorMode: 'BW', paperSize: 'A4', sides: 'SINGLE', copies: 1, binding: 'none', totalPages: 100 },
        customPricing,
        0
      );

      // Subtotal = 200.0, Tax = 10.0, Total = 210.0
      expect(result.tax).toBe(10.0);
      expect(result.totalAmount).toBe(210.0);
    });
  });
});
