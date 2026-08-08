const fs = require('fs');
const prisma = require('../config/db');

let cleanupInterval = null;

/**
 * Get configured retention minutes from SystemSettings or default 30
 */
async function getRetentionMinutes() {
  try {
    const setting = await prisma.systemSetting.findUnique({
      where: { key: 'auto_delete_printed_docs_minutes' },
    });
    return setting ? Math.max(1, parseInt(setting.value) || 30) : 30;
  } catch {
    return 30;
  }
}

/**
 * Auto-delete document files on disk 30 minutes (or configured minutes) after printing
 */
async function runAutoCleanup() {
  try {
    const retentionMinutes = await getRetentionMinutes();
    const cutoffTime = new Date(Date.now() - retentionMinutes * 60 * 1000);

    // Find printed/delivered orders where cutoff time has passed and doc file is not yet deleted
    const expiredOrders = await prisma.order.findMany({
      where: {
        orderStatus: { in: ['PRINTED', 'DELIVERED'] },
        updatedAt: { lte: cutoffTime },
        document: {
          NOT: {
            filePath: { startsWith: '[AUTO_DELETED]' },
          },
        },
      },
      include: {
        document: true,
      },
    });

    for (const order of expiredOrders) {
      const doc = order.document;
      if (!doc || doc.filePath.startsWith('[AUTO_DELETED]')) continue;

      // Delete physical file from disk if it exists
      if (fs.existsSync(doc.filePath)) {
        try {
          fs.unlinkSync(doc.filePath);
        } catch (err) {
          console.error(`[AutoCleanup] Failed to unlink file ${doc.filePath}:`, err.message);
        }
      }

      // Mark document file as auto-deleted in DB
      await prisma.document.update({
        where: { id: doc.id },
        data: {
          filePath: `[AUTO_DELETED] ${new Date().toISOString()}`,
          status: 'PRINTED',
        },
      });

      console.log(`[AutoCleanup] Auto-deleted file for document #${doc.id} ("${doc.originalName}") ${retentionMinutes} mins after printing.`);
    }

    // Auto-purge unprinted draft documents uploaded > 30 minutes ago without user interaction/order completion
    const inactiveDraftDocs = await prisma.document.findMany({
      where: {
        createdAt: { lte: cutoffTime },
        orders: { none: {} },
        NOT: {
          filePath: { startsWith: '[AUTO_DELETED]' },
        },
      },
    });

    for (const doc of inactiveDraftDocs) {
      if (fs.existsSync(doc.filePath)) {
        try {
          fs.unlinkSync(doc.filePath);
        } catch (err) {
          console.error(`[AutoCleanup] Failed to unlink inactive draft ${doc.filePath}:`, err.message);
        }
      }

      await prisma.document.update({
        where: { id: doc.id },
        data: {
          filePath: `[AUTO_DELETED] ${new Date().toISOString()}`,
          status: 'PRINTED',
        },
      });

      console.log(`[AutoCleanup] Auto-deleted inactive draft file for document #${doc.id} ("${doc.originalName}") due to ${retentionMinutes} mins of inactivity.`);
    }
  } catch (err) {
    console.error('[AutoCleanup] Periodic cleanup error:', err);
  }
}

/**
 * Start periodic cleanup job (runs every 60 seconds)
 */
function startAutoCleanupJob() {
  if (cleanupInterval) return;
  
  // Run once immediately on startup
  runAutoCleanup();

  // Run every 60 seconds
  cleanupInterval = setInterval(runAutoCleanup, 60 * 1000);
  console.log('[AutoCleanup] Background printed document auto-deletion service started.');
}

module.exports = {
  getRetentionMinutes,
  runAutoCleanup,
  startAutoCleanupJob,
};
