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
    soft_cover: 50,
    hardcover: 100,
  },
  taxRate: 0.18,          // 18% GST
  maxPagesPerOrder: 500,  // Maximum allowed pages per single order
  minOrderAmount: 0,      // Minimum order cart threshold
  rushFee: 0,             // Rush / express order surcharge
  merchantUpiId: 'trackify@icici', // Merchant UPI VPA for customer payments
  merchantName: 'Inks by Trackify', // Business name displayed on UPI apps
  autoApprovePayments: false,       // Require admin verification of payments
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

    const pricing = { ...DEFAULT_PRICING, ...JSON.parse(setting.value) };
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
    const {
      bwRate,
      colorRate,
      duplexDiscount,
      paperSizeMultipliers,
      bindingRates,
      taxRate,
      maxPagesPerOrder,
      minOrderAmount,
      rushFee,
      merchantUpiId,
      merchantName,
      autoApprovePayments
    } = req.body;

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
      minOrderAmount: parseFloat(minOrderAmount) >= 0 ? parseFloat(minOrderAmount) : (existingPricing.minOrderAmount || 0),
      rushFee: parseFloat(rushFee) >= 0 ? parseFloat(rushFee) : (existingPricing.rushFee || 0),
      merchantUpiId: (merchantUpiId || existingPricing.merchantUpiId || 'trackify@icici').trim(),
      merchantName: (merchantName || existingPricing.merchantName || 'Inks by Trackify').trim(),
      autoApprovePayments: autoApprovePayments !== undefined ? Boolean(autoApprovePayments) : Boolean(existingPricing.autoApprovePayments),
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
