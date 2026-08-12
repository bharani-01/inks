const prisma = require('../config/db');
const { sendEmail, SENDERS, emailLayout } = require('../services/email.service');

/**
 * POST /api/admin/broadcast
 * Send email to all active users (or filtered)
 */
async function sendBroadcast(req, res) {
  try {
    const { subject, body, recipientFilter = 'all' } = req.body;

    if (!subject || !body) {
      return res.status(400).json({ message: 'Subject and body are required' });
    }

    let where = { isActive: true, emailPrefPromos: true };
    if (recipientFilter === 'users') where.role = 'USER';
    if (recipientFilter === 'admins') where.role = { in: ['ADMIN', 'PRINTER_ADMIN'] };

    const recipients = await prisma.user.findMany({
      where,
      select: { email: true, name: true, unsubscribeToken: true },
    });

    // Record broadcast
    const broadcast = await prisma.adminBroadcast.create({
      data: {
        subject,
        body,
        sentBy: req.user.id,
        sentCount: recipients.length,
      },
    });

    // Send in batches of 50
    const BATCH_SIZE = 50;
    let sent = 0;
    for (let i = 0; i < recipients.length; i += BATCH_SIZE) {
      const batch = recipients.slice(i, i + BATCH_SIZE);
      const promises = batch.map(r => {
        const unsubLink = r.unsubscribeToken
          ? `${process.env.APP_URL || 'http://localhost:3000'}/api/unsubscribe/${r.unsubscribeToken}?category=promos`
          : '';
        const footer = unsubLink
          ? `<p style="font-size:11px;color:#94a3b8;margin-top:24px;">Don't want promotional emails? <a href="${unsubLink}" style="color:#6366f1;">Unsubscribe</a></p>`
          : '';

        const html = emailLayout(`
          <h2 style="font-size:20px;font-weight:700;color:#0f172a;margin:0 0 12px;">${subject}</h2>
          <div style="font-size:14px;color:#334155;line-height:1.7;">${body}</div>
          ${footer}
        `, subject);

        return sendEmail({
          from: SENDERS.NOTIFICATIONS,
          to: r.email,
          subject,
          html,
          text: body.replace(/<[^>]*>/g, ''),
        }).catch(() => {});
      });
      await Promise.allSettled(promises);
      sent += batch.length;

      // Brief delay between batches
      if (i + BATCH_SIZE < recipients.length) {
        await new Promise(r => setTimeout(r, 1000));
      }
    }

    res.json({ message: `Broadcast sent to ${sent} recipients`, broadcast });
  } catch (err) {
    console.error('Broadcast error:', err);
    res.status(500).json({ message: 'Failed to send broadcast' });
  }
}

/**
 * GET /api/admin/broadcasts
 * List past broadcasts
 */
async function listBroadcasts(req, res) {
  try {
    const broadcasts = await prisma.adminBroadcast.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    res.json({ broadcasts });
  } catch (err) {
    console.error('List broadcasts error:', err);
    res.status(500).json({ message: 'Failed to list broadcasts' });
  }
}

module.exports = { sendBroadcast, listBroadcasts };
