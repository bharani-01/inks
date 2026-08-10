const prisma = require('../config/db');

/**
 * Get user's notifications + unread count
 * GET /api/notifications
 */
async function getNotifications(req, res) {
  try {
    const userId = req.user.id;

    const [notifications, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 30,
      }),
      prisma.notification.count({
        where: { userId, isRead: false },
      }),
    ]);

    res.json({ notifications, unreadCount });
  } catch (err) {
    console.error('GetNotifications error:', err);
    res.status(500).json({ message: 'Failed to fetch notifications' });
  }
}

/**
 * Mark a single notification as read
 * PUT /api/notifications/:id/read
 */
async function markAsRead(req, res) {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ message: 'Invalid notification ID' });

    const notification = await prisma.notification.updateMany({
      where: { id, userId: req.user.id },
      data: { isRead: true },
    });

    res.json({ message: 'Marked as read', count: notification.count });
  } catch (err) {
    console.error('MarkAsRead error:', err);
    res.status(500).json({ message: 'Failed to mark notification' });
  }
}

/**
 * Mark all notifications as read
 * PUT /api/notifications/read-all
 */
async function markAllAsRead(req, res) {
  try {
    await prisma.notification.updateMany({
      where: { userId: req.user.id, isRead: false },
      data: { isRead: true },
    });

    res.json({ message: 'All notifications marked as read' });
  } catch (err) {
    console.error('MarkAllAsRead error:', err);
    res.status(500).json({ message: 'Failed to mark all notifications' });
  }
}

module.exports = {
  getNotifications,
  markAsRead,
  markAllAsRead,
};
