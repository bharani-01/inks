/**
 * Feedback Controller
 * Admin-only endpoints for viewing customer feedback
 */

const prisma = require('../config/db');

/**
 * GET /api/feedback
 * Returns all feedback submissions with order/customer details.
 * ADMIN only.
 */
async function getAllFeedback(req, res) {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, parseInt(req.query.limit) || 20);
    const skip = (page - 1) * limit;

    const [feedback, total] = await Promise.all([
      prisma.feedback.findMany({
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          order: {
            select: {
              orderNumber: true,
              totalAmount: true,
              colorMode: true,
              createdAt: true,
              user: {
                select: { id: true, name: true, email: true },
              },
            },
          },
        },
      }),
      prisma.feedback.count(),
    ]);

    // Aggregate stats
    const ratingStats = await prisma.feedback.aggregate({
      _avg: { rating: true },
      _count: { rating: true },
    });

    const ratingDist = await prisma.feedback.groupBy({
      by: ['rating'],
      _count: { rating: true },
      where: { rating: { not: null } },
      orderBy: { rating: 'asc' },
    });

    res.json({
      feedback,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      stats: {
        totalFeedback: total,
        averageRating: ratingStats._avg.rating
          ? Math.round(ratingStats._avg.rating * 10) / 10
          : null,
        ratedCount: ratingStats._count.rating,
        ratingDistribution: ratingDist,
      },
    });
  } catch (err) {
    console.error('GetAllFeedback error:', err);
    res.status(500).json({ message: 'Failed to fetch feedback' });
  }
}

module.exports = { getAllFeedback };
