const prisma = require('../config/db');

/**
 * Creates an in-app notification for a specific user.
 */
async function createNotification({ userId, title, message, type = 'INFO', link = null }) {
  try {
    return await prisma.notification.create({
      data: {
        userId,
        title,
        message,
        type,
        link,
      },
    });
  } catch (err) {
    console.error('Failed to create notification:', err.message);
    return null;
  }
}

/**
 * Sends a broadcast notification to all active administrators and printer admins.
 */
async function notifyAdmins({ title, message, type = 'ADMIN_ALERT', link = null }) {
  try {
    const staff = await prisma.user.findMany({
      where: { role: { in: ['ADMIN', 'PRINTER_ADMIN'] }, isActive: true },
      select: { id: true },
    });

    const notifications = staff.map((member) => ({
      userId: member.id,
      title,
      message,
      type,
      link,
    }));

    if (notifications.length > 0) {
      await prisma.notification.createMany({ data: notifications });
    }
  } catch (err) {
    console.error('Failed to notify admins:', err.message);
  }
}

module.exports = {
  createNotification,
  notifyAdmins,
};
