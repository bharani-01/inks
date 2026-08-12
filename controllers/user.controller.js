const bcrypt = require('bcryptjs');
const prisma = require('../config/db');

/**
 * Get all users (Admin only)
 * GET /api/users?page=1&limit=10&search=&role=&status=
 */
async function getAllUsers(req, res) {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 10));
    const search = req.query.search || '';
    const roleFilter = req.query.role || '';
    const statusFilter = req.query.status || '';

    // Build where clause
    const where = {};

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (roleFilter && ['USER', 'ADMIN', 'PRINTER_ADMIN'].includes(roleFilter.toUpperCase())) {
      where.role = roleFilter.toUpperCase();
    }

    if (statusFilter === 'active') {
      where.isActive = true;
    } else if (statusFilter === 'inactive' || statusFilter === 'pending') {
      where.isActive = false;
    }

    const [users, total, pendingCount] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          role: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
        },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.user.count({ where }),
      prisma.user.count({ where: { isActive: false } }),
    ]);

    res.json({
      users,
      pendingCount,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    console.error('GetAllUsers error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
}

/**
 * Get user stats (Admin only)
 * GET /api/users/stats
 */
async function getUserStats(req, res) {
  try {
    const [total, active, admins] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { isActive: true } }),
      prisma.user.count({ where: { role: 'ADMIN' } }),
    ]);

    res.json({ total, active, inactive: total - active, admins });
  } catch (err) {
    console.error('GetUserStats error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
}

async function getUserFullProfileData(userId) {
  const [user, ordersCount, totalSpentAgg, totalPagesAgg, documentsCount, recentOrders, recentDocuments] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        isActive: true,
        avatarUrl: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
    prisma.order.count({ where: { userId } }),
    prisma.order.aggregate({
      where: { userId, paymentStatus: 'PAID' },
      _sum: { totalAmount: true },
    }),
    prisma.order.aggregate({
      where: { userId },
      _sum: { totalPages: true },
    }),
    prisma.document.count({ where: { userId } }),
    prisma.order.findMany({
      where: { userId },
      take: 10,
      orderBy: { createdAt: 'desc' },
      include: {
        document: {
          select: { id: true, originalName: true, mimeType: true, fileSize: true },
        },
      },
    }),
    prisma.document.findMany({
      where: { userId },
      take: 10,
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  if (!user) return null;

  const stats = {
    ordersCount,
    totalSpent: totalSpentAgg._sum.totalAmount || 0,
    totalPagesPrinted: totalPagesAgg._sum.totalPages || 0,
    documentsCount,
  };

  return { user, stats, recentOrders, recentDocuments };
}

/**
 * Get single user by ID with print history and statistics (Admin only)
 * GET /api/users/:id
 */
async function getUserById(req, res) {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: 'Invalid user ID' });
    }

    const data = await getUserFullProfileData(id);
    if (!data) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json(data);
  } catch (err) {
    console.error('GetUserById error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
}

/**
 * Update user role (Admin only)
 * PUT /api/users/:id
 */
async function updateUser(req, res) {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: 'Invalid user ID' });
    }

    const { name, email, phone, role } = req.body;

    // If changing role, check it's not the last admin
    if (role && role !== 'ADMIN') {
      const targetUser = await prisma.user.findUnique({ where: { id } });
      if (targetUser && targetUser.role === 'ADMIN') {
        const adminCount = await prisma.user.count({ where: { role: 'ADMIN' } });
        if (adminCount <= 1) {
          return res.status(400).json({ message: 'Cannot remove the last admin' });
        }
      }
    }

    // Check email uniqueness if email is being changed
    if (email) {
      const existing = await prisma.user.findFirst({
        where: { email: email.toLowerCase().trim(), NOT: { id } },
      });
      if (existing) {
        return res.status(409).json({ message: 'Email already in use' });
      }
    }

    const updateData = {};
    if (name) updateData.name = name;
    if (email) updateData.email = email.toLowerCase().trim();
    if (phone !== undefined) updateData.phone = phone || null;
    if (role && ['USER', 'ADMIN', 'PRINTER_ADMIN'].includes(role.toUpperCase())) {
      updateData.role = role.toUpperCase();
    }

    const user = await prisma.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    res.json({ user, message: 'User updated successfully' });
  } catch (err) {
    if (err.code === 'P2025') {
      return res.status(404).json({ message: 'User not found' });
    }
    console.error('UpdateUser error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
}

/**
 * Toggle user active status (Admin only)
 * PUT /api/users/:id/toggle-status
 */
async function toggleUserStatus(req, res) {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: 'Invalid user ID' });
    }

    // Block self-deactivation
    if (id === req.user.id) {
      return res.status(400).json({ message: 'You cannot deactivate your own account' });
    }

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Block deactivating last admin
    if (user.role === 'ADMIN' && user.isActive) {
      const activeAdmins = await prisma.user.count({
        where: { role: 'ADMIN', isActive: true },
      });
      if (activeAdmins <= 1) {
        return res.status(400).json({ message: 'Cannot deactivate the last active admin' });
      }
    }

    const updated = await prisma.user.update({
      where: { id },
      data: { isActive: !user.isActive },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
      },
    });

    if (updated.isActive) {
      const { createNotification } = require('../services/notification.service');
      const { sendAccountApprovedEmail } = require('../services/email.service');

      createNotification({
        userId: updated.id,
        title: 'Account Approved!',
        message: 'Welcome to Printa! Your account has been approved and activated by an administrator.',
        type: 'APPROVAL',
        link: '/user/print',
      }).catch(() => {});

      if (updated.email) {
        sendAccountApprovedEmail({
          to: updated.email,
          name: updated.name,
        }).catch(() => {});
      }
    }

    res.json({
      user: updated,
      message: `User ${updated.isActive ? 'activated' : 'deactivated'} successfully`,
    });
  } catch (err) {
    console.error('ToggleStatus error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
}

/**
 * Get own profile with full statistics and activity history
 * GET /api/users/profile
 */
async function getProfile(req, res) {
  try {
    const data = await getUserFullProfileData(req.user.id);
    if (!data) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json(data);
  } catch (err) {
    console.error('GetProfile error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
}

/**
 * Update own profile
 * PUT /api/users/profile
 */
async function updateProfile(req, res) {
  try {
    const { name, email, phone } = req.body;

    if (!name && !email && phone === undefined) {
      return res.status(400).json({ message: 'No fields to update' });
    }

    // Check email uniqueness
    if (email) {
      const existing = await prisma.user.findFirst({
        where: { email: email.toLowerCase().trim(), NOT: { id: req.user.id } },
      });
      if (existing) {
        return res.status(409).json({ message: 'Email already in use' });
      }
    }

    const updateData = {};
    if (name) updateData.name = name;
    if (email) updateData.email = email.toLowerCase().trim();
    if (phone !== undefined) updateData.phone = phone || null;

    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: updateData,
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        isActive: true,
        avatarUrl: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    res.json({ user, message: 'Profile updated successfully' });
  } catch (err) {
    console.error('UpdateProfile error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
}

/**
 * Change own password
 * PUT /api/users/change-password
 */
async function changePassword(req, res) {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: 'Current and new password are required' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ message: 'New password must be at least 6 characters' });
    }

    // Verify current password
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    const isMatch = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ message: 'Current password is incorrect' });
    }

    // Hash and update
    const passwordHash = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({
      where: { id: req.user.id },
      data: { passwordHash },
    });

    res.json({ message: 'Password changed successfully' });
  } catch (err) {
    console.error('ChangePassword error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
}

/**
 * Create a new user (Admin only)
 * POST /api/users
 */
async function createUser(req, res) {
  try {
    const { name, email, password, phone, role, isActive } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ message: 'Full name is required' });
    }

    if (!email || !email.trim()) {
      return res.status(400).json({ message: 'Email address is required' });
    }

    const cleanEmail = email.toLowerCase().trim();

    if (!password || password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters' });
    }

    // Check if email already exists
    const existing = await prisma.user.findUnique({
      where: { email: cleanEmail },
    });

    if (existing) {
      return res.status(409).json({ message: 'A user with this email already exists' });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const assignedRole = (role && ['USER', 'ADMIN', 'PRINTER_ADMIN'].includes(role.toUpperCase())) ? role.toUpperCase() : 'USER';
    const activeStatus = typeof isActive === 'boolean' ? isActive : true;

    const user = await prisma.user.create({
      data: {
        name: name.trim(),
        email: cleanEmail,
        passwordHash,
        phone: phone ? phone.trim() : null,
        role: assignedRole,
        isActive: activeStatus,
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    res.status(201).json({
      user,
      message: `User ${user.name} created successfully`,
    });
  } catch (err) {
    console.error('CreateUser error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
}

/**
 * Delete user (Admin only)
 * DELETE /api/users/:id
 */
async function deleteUser(req, res) {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ message: 'Invalid user ID' });

    if (id === req.user.id) {
      return res.status(400).json({ message: 'You cannot delete your own account' });
    }

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (user.role === 'ADMIN') {
      const adminCount = await prisma.user.count({ where: { role: 'ADMIN' } });
      if (adminCount <= 1) {
        return res.status(400).json({ message: 'Cannot delete the last admin user' });
      }
    }

    const orderCount = await prisma.order.count({ where: { userId: id } });
    if (orderCount > 0) {
      await prisma.user.update({
        where: { id },
        data: { isActive: false },
      });
      return res.json({ message: 'User has existing order history; account was deactivated instead of deleted.' });
    }

    await prisma.user.delete({ where: { id } });
    res.json({ message: 'User deleted successfully' });
  } catch (err) {
    console.error('DeleteUser error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
}

/**
 * Get email preferences for logged-in user
 * GET /api/users/email-preferences
 */
async function getEmailPreferences(req, res) {
  try {
    let user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        emailPrefOrders: true,
        emailPrefPayments: true,
        emailPrefPromos: true,
        emailPrefDigest: true,
        unsubscribeToken: true,
      },
    });

    if (user && !user.unsubscribeToken) {
      const crypto = require('crypto');
      const token = crypto.randomBytes(24).toString('hex');
      user = await prisma.user.update({
        where: { id: req.user.id },
        data: { unsubscribeToken: token },
        select: {
          emailPrefOrders: true,
          emailPrefPayments: true,
          emailPrefPromos: true,
          emailPrefDigest: true,
          unsubscribeToken: true,
        },
      });
    }

    res.json({ preferences: user });
  } catch (err) {
    console.error('GetEmailPreferences error:', err);
    res.status(500).json({ message: 'Failed to fetch email preferences' });
  }
}

/**
 * Update email preferences for logged-in user
 * PUT /api/users/email-preferences
 */
async function updateEmailPreferences(req, res) {
  try {
    const { emailPrefOrders, emailPrefPayments, emailPrefPromos, emailPrefDigest } = req.body;

    const data = {};
    if (typeof emailPrefOrders === 'boolean') data.emailPrefOrders = emailPrefOrders;
    if (typeof emailPrefPayments === 'boolean') data.emailPrefPayments = emailPrefPayments;
    if (typeof emailPrefPromos === 'boolean') data.emailPrefPromos = emailPrefPromos;
    if (typeof emailPrefDigest === 'boolean') data.emailPrefDigest = emailPrefDigest;

    const updated = await prisma.user.update({
      where: { id: req.user.id },
      data,
      select: {
        emailPrefOrders: true,
        emailPrefPayments: true,
        emailPrefPromos: true,
        emailPrefDigest: true,
      },
    });

    res.json({ preferences: updated, message: 'Email preferences updated successfully' });
  } catch (err) {
    console.error('UpdateEmailPreferences error:', err);
    res.status(500).json({ message: 'Failed to update email preferences' });
  }
}

module.exports = {
  getAllUsers,
  getUserStats,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
  toggleUserStatus,
  getProfile,
  updateProfile,
  changePassword,
  getEmailPreferences,
  updateEmailPreferences,
};
