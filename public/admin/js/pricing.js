/**
 * Printa — Admin Pricing Manager Logic
 */
document.addEventListener('DOMContentLoaded', async () => {
  await loadPricingForm();

  const form = document.getElementById('pricing-form');
  if (form) {
    form.addEventListener('submit', handleSavePricing);
  }
});

async function loadPricingForm() {
  try {
    const data = await api.get('/settings/pricing');
    const p = data.pricing;

    document.getElementById('bwRate').value = p.bwRate;
    document.getElementById('colorRate').value = p.colorRate;
    document.getElementById('duplexDiscount').value = (p.duplexDiscount * 100).toFixed(0);

    document.getElementById('paper-a4').value = p.paperSizeMultipliers?.A4 || 1.0;
    document.getElementById('paper-a3').value = p.paperSizeMultipliers?.A3 || 1.8;
    document.getElementById('paper-letter').value = p.paperSizeMultipliers?.LETTER || 1.0;
    document.getElementById('paper-legal').value = p.paperSizeMultipliers?.LEGAL || 1.2;

    document.getElementById('bind-none').value = p.bindingRates?.none || 0;
    document.getElementById('bind-stapled').value = p.bindingRates?.stapled || 5;
    document.getElementById('bind-spiral').value = p.bindingRates?.spiral || 30;
    document.getElementById('bind-hardcover').value = p.bindingRates?.hardcover || 100;

    document.getElementById('taxRate').value = (p.taxRate * 100).toFixed(0);
    document.getElementById('maxPagesPerOrder').value = p.maxPagesPerOrder || 500;
  } catch (err) {
    showToast('Failed to load current pricing configuration', 'error');
  }
}

async function handleSavePricing(e) {
  e.preventDefault();
  const btn = e.target.querySelector('button[type="submit"]');

  const payload = {
    bwRate: parseFloat(document.getElementById('bwRate').value),
    colorRate: parseFloat(document.getElementById('colorRate').value),
    duplexDiscount: parseFloat(document.getElementById('duplexDiscount').value) / 100,
    paperSizeMultipliers: {
      A4: parseFloat(document.getElementById('paper-a4').value),
      A3: parseFloat(document.getElementById('paper-a3').value),
      LETTER: parseFloat(document.getElementById('paper-letter').value),
      LEGAL: parseFloat(document.getElementById('paper-legal').value),
    },
    bindingRates: {
      none: parseFloat(document.getElementById('bind-none').value),
      stapled: parseFloat(document.getElementById('bind-stapled').value),
      spiral: parseFloat(document.getElementById('bind-spiral').value),
      hardcover: parseFloat(document.getElementById('bind-hardcover').value),
    },
    taxRate: parseFloat(document.getElementById('taxRate').value) / 100,
    maxPagesPerOrder: parseInt(document.getElementById('maxPagesPerOrder').value) || 500,
  };

  btn.disabled = true;
  btn.innerHTML = `<span class="spinner"></span> Saving...`;

  try {
    const res = await api.put('/settings/pricing', payload);
    showToast(res.message || 'Pricing configuration updated successfully!', 'success');
  } catch (err) {
    showToast(err.message || 'Failed to update pricing settings', 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = `Save Pricing Configuration`;
  }
}
