const prisma = require('../config/db');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const { createNotification, notifyAdmins } = require('../services/notification.service');
const { sendPaymentInvoiceEmail } = require('../services/email.service');
const { generateCoverPage } = require('../services/coverPage.service');

const UPLOADS_DIR = path.normalize(path.resolve(__dirname, '..', 'uploads'));
const MAX_TOPUP_AMOUNT = 50000; // Max ₹50,000 per single topup
const MIN_TOPUP_AMOUNT = 1;     // Min ₹1

/**
 * Generate human-readable unique transaction reference number
 * Format: TXN-CR-260811-9482 or TXN-DB-260811-3829
 */
function generateTxnNumber(type) {
  const prefix = type === 'CREDIT' ? 'TXN-CR' : 'TXN-DB';
  const now = new Date();
  const dateStr = now.toISOString().slice(2, 10).replace(/-/g, '');
  const random = Math.floor(1000 + Math.random() * 9000);
  return `${prefix}-${dateStr}-${random}`;
}

/**
 * Helper: Find or lazily initialize wallet for a user (fast index lookup)
 */
async function getOrCreateWallet(userId, tx = prisma) {
  let wallet = await tx.wallet.findUnique({
    where: { userId },
  });
  if (!wallet) {
    wallet = await tx.wallet.create({
      data: { userId, balance: 0 },
    });
  }
  return wallet;
}

/**
 * Get current user's wallet details & summary stats (Fast & optimized)
 * GET /api/wallet?full=true
 */
async function getMyWallet(req, res) {
  try {
    const wallet = await getOrCreateWallet(req.user.id);
    const needFull = req.query.full === 'true';

    let stats = { totalCredited: 0, totalSpent: 0, totalTxCount: 0 };
    let recentTransactions = [];

    // Only compute heavy full table aggregations when user is on the full wallet dashboard
    if (needFull) {
      const [aggregates, recents, totalCount] = await Promise.all([
        prisma.walletTransaction.groupBy({
          by: ['type'],
          where: { walletId: wallet.id },
          _sum: { amount: true },
        }),
        prisma.walletTransaction.findMany({
          where: { walletId: wallet.id },
          take: 5,
          orderBy: { createdAt: 'desc' },
        }),
        prisma.walletTransaction.count({
          where: { walletId: wallet.id },
        }),
      ]);

      for (const agg of aggregates) {
        if (agg.type === 'CREDIT') stats.totalCredited = Math.round((agg._sum.amount || 0) * 100) / 100;
        if (agg.type === 'DEBIT') stats.totalSpent = Math.round((agg._sum.amount || 0) * 100) / 100;
      }
      stats.totalTxCount = totalCount;
      recentTransactions = recents;
    }

    res.json({
      wallet: {
        id: wallet.id,
        balance: wallet.balance,
        updatedAt: wallet.updatedAt,
      },
      stats,
      recentTransactions,
    });
  } catch (err) {
    console.error('GetMyWallet error:', err);
    res.status(500).json({ message: 'Failed to fetch wallet information' });
  }
}

/**
 * Get current user's wallet transactions (paginated & filterable)
 * GET /api/wallet/transactions?page=1&limit=15&type=ALL
 */
async function getMyTransactions(req, res) {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 15));
    const typeFilter = req.query.type;
    const search = req.query.search ? req.query.search.trim() : '';

    const wallet = await getOrCreateWallet(req.user.id);

    const where = {
      walletId: wallet.id,
      ...(typeFilter && ['CREDIT', 'DEBIT'].includes(typeFilter) ? { type: typeFilter } : {}),
      ...(search
        ? {
            OR: [
              { txnNumber: { contains: search, mode: 'insensitive' } },
              { referenceId: { contains: search, mode: 'insensitive' } },
              { description: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [transactions, total] = await Promise.all([
      prisma.walletTransaction.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.walletTransaction.count({ where }),
    ]);

    res.json({
      transactions,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    console.error('GetMyTransactions error:', err);
    res.status(500).json({ message: 'Failed to fetch transaction history' });
  }
}

/**
 * Pay for an Order using Ink Wallet (Atomic & strictly validated)
 * POST /api/wallet/pay
 * Body: { orderId }
 */
async function payOrderFromWallet(req, res) {
  try {
    const orderId = parseInt(req.body.orderId);
    if (isNaN(orderId)) {
      return res.status(400).json({ message: 'Valid order ID is required' });
    }

    // 1. Initial lookup & ownership validation
    const existingOrder = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        user: { select: { id: true, name: true, email: true } },
        document: true,
      },
    });

    if (!existingOrder) {
      return res.status(404).json({ message: 'Order not found' });
    }

    if (existingOrder.userId !== req.user.id && req.user.role !== 'ADMIN') {
      return res.status(403).json({ message: 'Access denied: You do not own this order' });
    }

    if (existingOrder.paymentStatus === 'PAID') {
      return res.status(400).json({ message: 'This order is already marked as PAID' });
    }

    const orderCost = existingOrder.totalAmount;
    if (typeof orderCost !== 'number' || orderCost <= 0) {
      return res.status(400).json({ message: 'Invalid order amount' });
    }

    // Pre-check wallet balance for clear user feedback
    const userWallet = await getOrCreateWallet(existingOrder.userId);
    if (userWallet.balance < orderCost) {
      const deficit = Math.round((orderCost - userWallet.balance) * 100) / 100;
      return res.status(400).json({
        message: `Insufficient Ink Wallet balance (₹${userWallet.balance.toFixed(2)}). Please top up ₹${deficit.toFixed(2)} more to place this order.`,
        insufficientBalance: true,
        currentBalance: userWallet.balance,
        deficit,
        requiredAmount: orderCost,
      });
    }

    const qrToken = crypto.randomUUID();

    // 2. Perform atomic debit & order status transition in a single serialized DB transaction
    const result = await prisma.$transaction(async (tx) => {
      // Fetch current wallet with latest state inside tx
      const wallet = await getOrCreateWallet(existingOrder.userId, tx);

      if (wallet.balance < orderCost) {
        const deficit = Math.round((orderCost - wallet.balance) * 100) / 100;
        throw new Error(`Insufficient wallet balance. You need ₹${deficit.toFixed(2)} more.`);
      }

      const balanceBefore = wallet.balance;
      const balanceAfter = Math.round((balanceBefore - orderCost) * 100) / 100;

      // Update wallet balance
      const updatedWallet = await tx.wallet.update({
        where: { id: wallet.id },
        data: { balance: balanceAfter },
      });

      // Record immutable ledger entry
      const transaction = await tx.walletTransaction.create({
        data: {
          txnNumber: generateTxnNumber('DEBIT'),
          walletId: wallet.id,
          type: 'DEBIT',
          amount: orderCost,
          balanceBefore,
          balanceAfter,
          description: `Payment for Print Order #${existingOrder.orderNumber}`,
          refType: 'ORDER',
          refId: existingOrder.id,
          referenceId: existingOrder.orderNumber,
        },
      });

      // Update Order to PAID status
      const updatedOrder = await tx.order.update({
        where: { id: existingOrder.id },
        data: {
          paymentStatus: 'PAID',
          paymentMethod: 'WALLET',
          walletAmount: orderCost,
          verifiedAt: new Date(),
          verifiedBy: req.user.id,
          paymentRejectReason: null,
          orderStatus: 'RECEIVED',
          qrToken,
        },
        include: {
          document: true,
          user: { select: { id: true, name: true, email: true } },
        },
      });

      // Update associated document status to PROCESSING
      if (existingOrder.documentId) {
        await tx.document.update({
          where: { id: existingOrder.documentId },
          data: { status: 'PROCESSING' },
        });
      }

      return {
        updatedOrder,
        updatedWallet,
        transaction,
        balanceAfter,
      };
    });

    // 3. Post-transaction operations (Background emails, notifications, PDF generation)
    const { updatedOrder, balanceAfter } = result;

    // Generate cover page PDF asynchronously
    try {
      const appUrl = process.env.APP_URL || 'https://inks.trackifyapp.co.in';
      const scanUrl = `${appUrl}/scan/${qrToken}`;
      const coverBuffer = await generateCoverPage(
        { ...updatedOrder, document: updatedOrder.document },
        updatedOrder.user,
        scanUrl
      );
      const coverPath = path.join(UPLOADS_DIR, `cover-${updatedOrder.id}.pdf`);
      fs.writeFileSync(coverPath, coverBuffer);
    } catch (coverErr) {
      console.error('Wallet payment cover page generation failed (non-fatal):', coverErr.message);
    }

    // Send tax invoice email to customer
    if (updatedOrder.user && updatedOrder.user.email) {
      sendPaymentInvoiceEmail({
        to: updatedOrder.user.email,
        name: updatedOrder.user.name,
        order: {
          ...updatedOrder,
          document: updatedOrder.document,
        },
      }).catch((err) => console.error('Failed to send invoice email after wallet payment:', err.message));
    }

    // Notify customer in-app
    createNotification({
      userId: updatedOrder.userId,
      title: 'Order Paid with Ink Wallet',
      message: `Your print order ${updatedOrder.orderNumber} (₹${updatedOrder.totalAmount}) has been paid from your Ink Wallet. Remaining balance: ₹${balanceAfter.toFixed(2)}.`,
      type: 'ORDER',
      link: `/user/orders?track=${updatedOrder.orderNumber}`,
    }).catch(() => {});

    // Notify admins of new paid print order
    notifyAdmins({
      title: 'New Paid Order (Ink Wallet)',
      message: `Customer ${updatedOrder.user?.name || 'User'} paid ₹${updatedOrder.totalAmount} for order ${updatedOrder.orderNumber} using Ink Wallet.`,
      type: 'ORDER',
      link: '/admin/orders',
    }).catch(() => {});

    res.json({
      success: true,
      order: updatedOrder,
      newBalance: balanceAfter,
      message: `Payment of ₹${orderCost.toFixed(2)} completed successfully using Ink Wallet`,
    });
  } catch (err) {
    if (err.isBalanceError || err.status === 400 || (err.message && err.message.includes('Insufficient wallet balance'))) {
      return res.status(400).json({ message: err.message });
    }
    console.error('PayOrderFromWallet error:', err);
    res.status(500).json({ message: err.message || 'Failed to process wallet payment' });
  }
}

/**
 * Admin: Top-up a user's wallet with security verification & audit logging
 * POST /api/wallet/admin/topup
 * Body: { userId, amount, note }
 */
async function adminTopUp(req, res) {
  try {
    if (req.user.role !== 'ADMIN') {
      return res.status(403).json({ message: 'Permission denied: Only Administrators can top up user wallets' });
    }

    const { userId, note } = req.body;
    const targetUserId = parseInt(userId);
    const amount = parseFloat(req.body.amount);

    if (isNaN(targetUserId)) {
      return res.status(400).json({ message: 'Valid target user ID is required' });
    }

    if (isNaN(amount) || amount < MIN_TOPUP_AMOUNT || amount > MAX_TOPUP_AMOUNT) {
      return res.status(400).json({
        message: `Top-up amount must be between ₹${MIN_TOPUP_AMOUNT} and ₹${MAX_TOPUP_AMOUNT.toLocaleString()}`,
      });
    }

    const cleanAmount = Math.round(amount * 100) / 100;
    const cleanNote = note && typeof note === 'string' ? note.trim().slice(0, 300) : 'Admin Balance Credit';
    const txnNumber = generateTxnNumber('CREDIT');
    const customRef = req.body.referenceId ? String(req.body.referenceId).trim().slice(0, 100) : null;
    const cleanReferenceId = customRef || txnNumber;

    // Verify target user exists
    const targetUser = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: { id: true, name: true, email: true, role: true, isActive: true },
    });

    if (!targetUser) {
      return res.status(404).json({ message: 'Target user not found' });
    }

    // Atomic top-up transaction
    const result = await prisma.$transaction(async (tx) => {
      const wallet = await getOrCreateWallet(targetUserId, tx);

      const balanceBefore = wallet.balance;
      const balanceAfter = Math.round((balanceBefore + cleanAmount) * 100) / 100;

      const updatedWallet = await tx.wallet.update({
        where: { id: wallet.id },
        data: { balance: balanceAfter },
      });

      const transaction = await tx.walletTransaction.create({
        data: {
          txnNumber,
          walletId: wallet.id,
          type: 'CREDIT',
          amount: cleanAmount,
          balanceBefore,
          balanceAfter,
          description: cleanNote,
          refType: 'TOPUP',
          referenceId: cleanReferenceId,
          createdBy: req.user.id, // Immutable audit: Which admin credited the balance
        },
      });

      return { updatedWallet, transaction, balanceAfter };
    });

    // Notify the user in-app
    createNotification({
      userId: targetUserId,
      title: 'Ink Wallet Credited! 💳',
      message: `Your Ink Wallet was credited with ₹${cleanAmount.toFixed(2)} by Admin (${cleanNote}). Current balance: ₹${result.balanceAfter.toFixed(2)}.`,
      type: 'INFO',
      link: '/user/wallet',
    }).catch(() => {});

    // Notify other admins of top-up audit event
    notifyAdmins({
      title: 'Wallet Top-Up Completed',
      message: `Admin ${req.user.name || 'Admin'} credited ₹${cleanAmount.toFixed(2)} to ${targetUser.name}'s wallet. Note: "${cleanNote}".`,
      type: 'SECURITY',
      link: '/admin/wallet',
    }).catch(() => {});

    res.json({
      success: true,
      wallet: result.updatedWallet,
      transaction: result.transaction,
      newBalance: result.balanceAfter,
      message: `Successfully credited ₹${cleanAmount.toFixed(2)} to ${targetUser.name}'s Ink Wallet`,
    });
  } catch (err) {
    console.error('AdminTopUp error:', err);
    res.status(500).json({ message: 'Failed to process wallet top-up' });
  }
}

/**
 * Admin: List all user wallets with search, sort & summary
 * GET /api/wallet/admin?search=&sortBy=&page=1&limit=15
 */
async function adminListWallets(req, res) {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 15));
    const search = req.query.search ? req.query.search.trim() : '';
    const sortBy = req.query.sortBy || 'balance_desc';

    const userWhere = {
      role: 'USER',
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { email: { contains: search, mode: 'insensitive' } },
              { phone: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    // Determine order
    let orderBy = {};
    if (sortBy === 'balance_desc') {
      orderBy = { wallet: { balance: 'desc' } };
    } else if (sortBy === 'balance_asc') {
      orderBy = { wallet: { balance: 'asc' } };
    } else if (sortBy === 'name_asc') {
      orderBy = { name: 'asc' };
    } else {
      orderBy = { createdAt: 'desc' };
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where: userWhere,
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          role: true,
          isActive: true,
          createdAt: true,
          wallet: {
            select: {
              id: true,
              balance: true,
              updatedAt: true,
              _count: {
                select: { transactions: true },
              },
            },
          },
          _count: {
            select: { orders: true, documents: true },
          },
        },
        skip: (page - 1) * limit,
        take: limit,
        orderBy,
      }),
      prisma.user.count({ where: userWhere }),
    ]);

    // Format list with default wallet if not yet created
    const formatted = users.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      phone: u.phone,
      isActive: u.isActive,
      createdAt: u.createdAt,
      balance: u.wallet ? u.wallet.balance : 0,
      walletId: u.wallet ? u.wallet.id : null,
      walletUpdatedAt: u.wallet ? u.wallet.updatedAt : null,
      transactionCount: u.wallet ? u.wallet._count.transactions : 0,
      totalOrders: u._count.orders,
      totalDocuments: u._count.documents,
    }));

    res.json({
      users: formatted,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    console.error('AdminListWallets error:', err);
    res.status(500).json({ message: 'Failed to fetch wallets' });
  }
}

/**
 * Admin: Get single user's wallet with complete end-to-end transaction history
 * GET /api/wallet/admin/user/:userId?page=1&limit=20&type=&search=
 */
async function adminGetWallet(req, res) {
  try {
    const userId = parseInt(req.params.userId);
    if (isNaN(userId)) return res.status(400).json({ message: 'Invalid user ID' });

    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
    });

    if (!targetUser) return res.status(404).json({ message: 'User not found' });

    const wallet = await getOrCreateWallet(userId);

    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    const typeFilter = req.query.type;
    const search = req.query.search ? req.query.search.trim() : '';

    const where = {
      walletId: wallet.id,
      ...(typeFilter && ['CREDIT', 'DEBIT'].includes(typeFilter) ? { type: typeFilter } : {}),
      ...(search
        ? {
            OR: [
              { txnNumber: { contains: search, mode: 'insensitive' } },
              { referenceId: { contains: search, mode: 'insensitive' } },
              { description: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [transactions, total, stats] = await Promise.all([
      prisma.walletTransaction.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.walletTransaction.count({ where }),
      prisma.walletTransaction.groupBy({
        by: ['type'],
        where: { walletId: wallet.id },
        _sum: { amount: true },
        _count: { id: true },
      }),
    ]);

    // Fetch creator admin details for CREDIT transactions
    const creatorIds = [
      ...new Set(transactions.filter((t) => t.createdBy).map((t) => t.createdBy)),
    ];

    let creatorsMap = {};
    if (creatorIds.length > 0) {
      const creators = await prisma.user.findMany({
        where: { id: { in: creatorIds } },
        select: { id: true, name: true, email: true },
      });
      creatorsMap = Object.fromEntries(creators.map((c) => [c.id, c]));
    }

    const formattedTransactions = transactions.map((t) => ({
      id: t.id,
      txnNumber: t.txnNumber,
      type: t.type,
      amount: t.amount,
      balanceBefore: t.balanceBefore,
      balanceAfter: t.balanceAfter,
      description: t.description,
      refType: t.refType,
      refId: t.refId,
      referenceId: t.referenceId,
      createdAt: t.createdAt,
      createdBy: t.createdBy,
      createdByAdmin: t.createdBy ? creatorsMap[t.createdBy] || null : null,
    }));

    let totalCredited = 0;
    let totalSpent = 0;
    let totalTxCount = 0;

    for (const agg of stats) {
      if (agg.type === 'CREDIT') totalCredited = Math.round((agg._sum.amount || 0) * 100) / 100;
      if (agg.type === 'DEBIT') totalSpent = Math.round((agg._sum.amount || 0) * 100) / 100;
      totalTxCount += agg._count.id || 0;
    }

    res.json({
      user: targetUser,
      wallet: {
        id: wallet.id,
        balance: wallet.balance,
        updatedAt: wallet.updatedAt,
      },
      stats: {
        totalCredited,
        totalSpent,
        totalTxCount,
      },
      transactions: formattedTransactions,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    console.error('AdminGetWallet error:', err);
    res.status(500).json({ message: 'Failed to fetch user wallet' });
  }
}

/**
 * Admin: System-wide global transaction ledger with search & creator details
 * GET /api/wallet/admin/transactions?page=1&limit=20&type=&search=
 */
async function adminAllTransactions(req, res) {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    const typeFilter = req.query.type;
    const search = req.query.search ? req.query.search.trim() : '';

    const where = {
      ...(typeFilter && ['CREDIT', 'DEBIT'].includes(typeFilter) ? { type: typeFilter } : {}),
      ...(search
        ? {
            OR: [
              { txnNumber: { contains: search, mode: 'insensitive' } },
              { referenceId: { contains: search, mode: 'insensitive' } },
              { description: { contains: search, mode: 'insensitive' } },
              {
                wallet: {
                  user: {
                    OR: [
                      { name: { contains: search, mode: 'insensitive' } },
                      { email: { contains: search, mode: 'insensitive' } },
                    ],
                  },
                },
              },
            ],
          }
        : {}),
    };

    const [transactions, total] = await Promise.all([
      prisma.walletTransaction.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          wallet: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  role: true,
                },
              },
            },
          },
        },
      }),
      prisma.walletTransaction.count({ where }),
    ]);

    // Fetch creator admin details for CREDIT transactions
    const creatorIds = [
      ...new Set(transactions.filter((t) => t.createdBy).map((t) => t.createdBy)),
    ];

    let creatorsMap = {};
    if (creatorIds.length > 0) {
      const creators = await prisma.user.findMany({
        where: { id: { in: creatorIds } },
        select: { id: true, name: true, email: true },
      });
      creatorsMap = Object.fromEntries(creators.map((c) => [c.id, c]));
    }

    const formatted = transactions.map((t) => ({
      id: t.id,
      txnNumber: t.txnNumber,
      referenceId: t.referenceId,
      type: t.type,
      amount: t.amount,
      balanceBefore: t.balanceBefore,
      balanceAfter: t.balanceAfter,
      description: t.description,
      refType: t.refType,
      refId: t.refId,
      createdAt: t.createdAt,
      user: t.wallet?.user || null,
      adminCreator: t.createdBy ? creatorsMap[t.createdBy] || { name: 'Admin ID #' + t.createdBy } : null,
    }));

    res.json({
      transactions: formatted,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    console.error('AdminAllTransactions error:', err);
    res.status(500).json({ message: 'Failed to fetch global transactions' });
  }
}

/**
 * Admin: Global wallet statistics overview
 * GET /api/wallet/admin/stats
 */
async function adminStats(req, res) {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [
      totalWalletsCount,
      totalCirculationAggregate,
      totalCreditsAggregate,
      totalDebitsAggregate,
      todayCreditsAggregate,
    ] = await Promise.all([
      prisma.wallet.count(),
      prisma.wallet.aggregate({
        _sum: { balance: true },
      }),
      prisma.walletTransaction.aggregate({
        _sum: { amount: true },
        where: { type: 'CREDIT' },
      }),
      prisma.walletTransaction.aggregate({
        _sum: { amount: true },
        where: { type: 'DEBIT' },
      }),
      prisma.walletTransaction.aggregate({
        _sum: { amount: true },
        where: {
          type: 'CREDIT',
          createdAt: { gte: today },
        },
      }),
    ]);

    const totalCirculation = Math.round((totalCirculationAggregate._sum.balance || 0) * 100) / 100;
    const totalCredits = Math.round((totalCreditsAggregate._sum.amount || 0) * 100) / 100;
    const totalSpent = Math.round((totalDebitsAggregate._sum.amount || 0) * 100) / 100;
    const todayCredits = Math.round((todayCreditsAggregate._sum.amount || 0) * 100) / 100;

    res.json({
      totalWalletsCount,
      totalCirculation,
      totalCredits,
      totalSpent,
      todayCredits,
    });
  } catch (err) {
    console.error('AdminStats error:', err);
    res.status(500).json({ message: 'Failed to fetch wallet stats' });
  }
}

module.exports = {
  getMyWallet,
  getMyTransactions,
  payOrderFromWallet,
  adminTopUp,
  adminListWallets,
  adminGetWallet,
  adminAllTransactions,
  adminStats,
};
