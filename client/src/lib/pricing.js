/**
 * Client-side pricing — mirrors calculateOrderBreakdown in
 * controllers/order.controller.js exactly. Used by the PUBLIC landing estimator,
 * since POST /orders/calculate requires auth. The logged-in wizard calls the
 * backend endpoint directly instead of using this.
 */

export const DEFAULT_PRICING = {
  bwRate: 2.0,
  colorRate: 10.0,
  duplexDiscount: 0.1,
  paperSizeMultipliers: { A4: 1.0, A3: 1.8, LETTER: 1.0, LEGAL: 1.2 },
  bindingRates: { none: 0, stapled: 5, spiral: 30, hardcover: 100 },
  taxRate: 0.18,
  maxPagesPerOrder: 500,
};

const round2 = (n) => Math.round(n * 100) / 100;

export function calculateBreakdown(options, pricing = DEFAULT_PRICING) {
  const {
    colorMode = 'BW',
    paperSize = 'A4',
    sides = 'SINGLE',
    copies = 1,
    binding = 'none',
    totalPages = 1,
  } = options;

  let pageRate = colorMode === 'COLOR' ? pricing.colorRate : pricing.bwRate;
  if (sides === 'DOUBLE') {
    pageRate = pageRate * (1 - (pricing.duplexDiscount || 0));
  }

  const paperMultiplier = pricing.paperSizeMultipliers?.[paperSize] ?? 1.0;
  const effectivePageRate = pageRate * paperMultiplier;

  const safeCopies = Math.max(1, copies);
  const printCost = effectivePageRate * totalPages * safeCopies;
  const bindingCost = (pricing.bindingRates?.[binding] || 0) * safeCopies;

  const subtotal = round2(printCost + bindingCost);
  const taxRate = pricing.taxRate ?? 0.18;
  const tax = round2(subtotal * taxRate);
  const totalAmount = round2(subtotal + tax);

  return {
    basePageRate: pageRate,
    effectivePageRate,
    totalPages,
    copies: safeCopies,
    printCost: round2(printCost),
    bindingCost,
    subtotal,
    taxRate,
    tax,
    totalAmount,
  };
}

/** Parse a page-range string ("all" or "1-5,8,10-12") into a page count. */
export function estimatePagesFromRange(range, pageCount = 1) {
  const trimmed = (range || '').trim();
  if (!trimmed || trimmed.toLowerCase() === 'all') {
    return Math.max(1, pageCount || 1);
  }
  let count = 0;
  for (const part of trimmed.split(',')) {
    if (part.includes('-')) {
      const [start, end] = part.split('-').map((n) => parseInt(n.trim(), 10));
      if (!isNaN(start) && !isNaN(end) && end >= start) count += end - start + 1;
    } else {
      const n = parseInt(part.trim(), 10);
      if (!isNaN(n)) count += 1;
    }
  }
  return Math.max(1, count);
}
