const prisma = require('../config/db');

const DEFAULT_PRICING = {
  bwRate: 2.0,            // ₹2 per page
  colorRate: 10.0,        // ₹10 per page
  duplexDiscount: 0.10,   // 10% discount on page rate for duplex
  paperSizeMultipliers: {
    A4: 1.0,
    A3: 1.8,
    LETTER: 1.0,
    LEGAL: 1.2,
  },
  bindingRates: {
    none: 0,
    stapled: 5,
    spiral: 30,
    hardcover: 100,
  },
  taxRate: 0.18,          // 18% GST
  maxPagesPerOrder: 500,  // Admin configurable page limit per order
};

/**
 * Get system pricing settings
 * GET /api/settings/pricing
 */
async function getPricingSettings(req, res) {
  try {
    const setting = await prisma.systemSetting.findUnique({
      where: { key: 'pricing_rules' },
    });

    if (!setting) {
      return res.json({ pricing: DEFAULT_PRICING });
    }

    const pricing = JSON.parse(setting.value);
    res.json({ pricing });
  } catch (err) {
    console.error('GetPricingSettings error:', err);
    res.status(500).json({ message: 'Failed to fetch pricing settings' });
  }
}

/**
 * Update system pricing settings (Admin only)
 * PUT /api/settings/pricing
 */
async function updatePricingSettings(req, res) {
  try {
    const { bwRate, colorRate, duplexDiscount, paperSizeMultipliers, bindingRates, taxRate, maxPagesPerOrder } = req.body;

    const current = await prisma.systemSetting.findUnique({ where: { key: 'pricing_rules' } });
    const existingPricing = current ? JSON.parse(current.value) : DEFAULT_PRICING;

    const newPricing = {
      bwRate: parseFloat(bwRate) >= 0 ? parseFloat(bwRate) : existingPricing.bwRate,
      colorRate: parseFloat(colorRate) >= 0 ? parseFloat(colorRate) : existingPricing.colorRate,
      duplexDiscount: parseFloat(duplexDiscount) >= 0 ? parseFloat(duplexDiscount) : existingPricing.duplexDiscount,
      paperSizeMultipliers: paperSizeMultipliers || existingPricing.paperSizeMultipliers,
      bindingRates: bindingRates || existingPricing.bindingRates,
      taxRate: parseFloat(taxRate) >= 0 ? parseFloat(taxRate) : existingPricing.taxRate,
      maxPagesPerOrder: parseInt(maxPagesPerOrder) > 0 ? parseInt(maxPagesPerOrder) : (existingPricing.maxPagesPerOrder || 500),
    };

    const updated = await prisma.systemSetting.upsert({
      where: { key: 'pricing_rules' },
      update: { value: JSON.stringify(newPricing) },
      create: { key: 'pricing_rules', value: JSON.stringify(newPricing) },
    });

    res.json({
      pricing: JSON.parse(updated.value),
      message: 'Pricing settings updated successfully',
    });
  } catch (err) {
    console.error('UpdatePricingSettings error:', err);
    res.status(500).json({ message: 'Failed to update pricing settings' });
  }
}

module.exports = {
  getPricingSettings,
  updatePricingSettings,
  DEFAULT_PRICING,
};
