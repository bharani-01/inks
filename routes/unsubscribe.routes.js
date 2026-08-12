const express = require('express');
const router = express.Router();
const prisma = require('../config/db');

/**
 * GET /api/unsubscribe/:token?category=promos|orders|payments|digest
 * Public one-click unsubscribe endpoint
 */
router.get('/:token', async (req, res) => {
  try {
    const { token } = req.params;
    const category = req.query.category || 'promos';

    const user = await prisma.user.findFirst({
      where: { unsubscribeToken: token },
    });

    if (!user) {
      return res.status(404).send(`
        <html>
          <body style="font-family: sans-serif; text-align: center; padding: 40px; background: #f8fafc;">
            <h2 style="color: #ef4444;">Invalid or Expired Unsubscribe Link</h2>
            <p style="color: #64748b;">This unsubscribe token could not be found.</p>
          </body>
        </html>
      `);
    }

    const data = {};
    if (category === 'orders') data.emailPrefOrders = false;
    else if (category === 'payments') data.emailPrefPayments = false;
    else if (category === 'digest') data.emailPrefDigest = false;
    else data.emailPrefPromos = false;

    await prisma.user.update({
      where: { id: user.id },
      data,
    });

    const categoryNames = {
      promos: 'Promotional & Offer Emails',
      orders: 'Order Status Update Emails',
      payments: 'Payment Confirmation Emails',
      digest: 'Weekly Summary Digest Emails',
    };

    res.send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Unsubscribed — Inks by Trackify</title>
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f1f5f9; display: flex; justify-center; align-items: center; min-height: 100vh; margin: 0; padding: 20px; box-sizing: border-box; }
            .card { background: white; max-width: 480px; width: 100%; padding: 32px; border-radius: 24px; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.05); text-align: center; margin: auto; }
            .icon { width: 48px; height: 48px; background: #ecfdf5; color: #10b981; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 16px; font-size: 24px; }
            h1 { font-size: 20px; font-weight: 700; color: #0f172a; margin: 0 0 8px; }
            p { font-size: 14px; color: #475569; line-height: 1.6; margin: 0 0 24px; }
            .btn { display: inline-block; background: #6366f1; color: white; padding: 10px 20px; border-radius: 12px; font-weight: 600; text-decoration: none; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="card">
            <div class="icon">✓</div>
            <h1>You have been unsubscribed</h1>
            <p>You will no longer receive <strong>${categoryNames[category] || 'these'}</strong> at <strong>${user.email}</strong>.</p>
            <a href="/login" class="btn">Return to Inks</a>
          </div>
        </body>
      </html>
    `);
  } catch (err) {
    console.error('Unsubscribe error:', err);
    res.status(500).send('Failed to process unsubscribe request');
  }
});

module.exports = router;
