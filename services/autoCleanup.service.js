const fs = require('fs');
const path = require('path');
const prisma = require('../config/db');

const UPLOADS_DIR = path.normalize(path.resolve(__dirname, '..', 'uploads'));

function safeResolveUpload(filePath) {
  if (!filePath || typeof filePath !== 'string') return null;
  const fileName = path.basename(filePath);
  const resolved = path.join(UPLOADS_DIR, fileName);
  return fs.existsSync(resolved) ? resolved : null;
}

let cleanupInterval = null;

/**
 * Get configured retention minutes from SystemSettings or default 10 minutes
 */
async function getRetentionMinutes() {
  try {
    const setting = await prisma.systemSetting.findUnique({
      where: { key: 'auto_delete_printed_docs_minutes' },
    });
    return setting ? Math.max(1, parseInt(setting.value) || 10) : 10;
  } catch {
    return 10;
  }
}

/**
 * Auto-delete document files on disk:
 * 1. Printed/Delivered orders: deleted 10 minutes after print/delivery
 * 2. Unprinted/Draft uploads: deleted 10 minutes after upload without an order
 * 3. Orphan temp files (render-*.pdf, render-*.html): deleted if older than 10 minutes
 */
async function runAutoCleanup() {
  try {
    const retentionMinutes = await getRetentionMinutes();
    const cutoffTime = new Date(Date.now() - retentionMinutes * 60 * 1000);

    // 1. Find printed/delivered orders where 10 mins cutoff has passed and file is not yet purged
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

      const safePath = safeResolveUpload(doc.filePath);

      // Delete physical file from disk
      if (safePath) {
        try {
          fs.unlinkSync(safePath);
          console.log(`[AutoCleanup] Deleted printed document file: ${path.basename(safePath)} (Order #${order.orderNumber})`);
        } catch (err) {
          console.warn(`[AutoCleanup] Failed to unlink file ${safePath}:`, err.message);
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
    }

    // 2. Auto-purge unprinted draft documents uploaded > 10 minutes ago without order completion
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
      const safePath = safeResolveUpload(doc.filePath);

      if (safePath) {
        try {
          fs.unlinkSync(safePath);
          console.log(`[AutoCleanup] Deleted abandoned draft file: ${path.basename(safePath)} (Doc #${doc.id})`);
        } catch (err) {
          console.warn(`[AutoCleanup] Failed to unlink inactive draft ${safePath}:`, err.message);
        }
      }

      await prisma.document.update({
        where: { id: doc.id },
        data: {
          filePath: `[AUTO_DELETED] ${new Date().toISOString()}`,
          status: 'PRINTED',
        },
      });
    }

    // 3. Purge orphaned temporary render artifacts older than 10 minutes
    if (fs.existsSync(UPLOADS_DIR)) {
      const files = fs.readdirSync(UPLOADS_DIR);
      const now = Date.now();
      const maxAgeMs = 10 * 60 * 1000;

      for (const file of files) {
        if (file.startsWith('render-') || file.startsWith('temp-') || file.startsWith('merged-')) {
          const filePath = path.join(UPLOADS_DIR, file);
          try {
            const stats = fs.statSync(filePath);
            if (now - stats.mtimeMs > maxAgeMs) {
              fs.unlinkSync(filePath);
              console.log(`[AutoCleanup] Removed orphan temp file: ${file}`);
            }
          } catch {}
        }
      }
    }
  } catch (err) {
    if (err.code === 'P1001' || err.code === 'P1017') {
      console.warn('[AutoCleanup] Database connection temporarily busy, will retry in next cycle.');
    } else {
      console.error('[AutoCleanup] Periodic cleanup error:', err.message || err);
    }
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
  console.log('[AutoCleanup] Background printed document auto-deletion service active (10-minute retention).');
}

module.exports = {
  getRetentionMinutes,
  runAutoCleanup,
  startAutoCleanupJob,
};
