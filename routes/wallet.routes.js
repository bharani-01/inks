const express = require('express');
const router = express.Router();
const walletController = require('../controllers/wallet.controller');
const authenticate = require('../middleware/auth');
const requireRole = require('../middleware/roleCheck');

// All wallet endpoints require valid authentication
router.use(authenticate);

// ── User Wallet Endpoints ──────────────────────────────────────────
router.get('/', walletController.getMyWallet);
router.get('/transactions', walletController.getMyTransactions);
router.post('/pay', walletController.payOrderFromWallet);
router.post('/pay-batch', walletController.payBatchOrderFromWallet);

// ── Admin-Only Wallet Management Endpoints ─────────────────────────
router.get('/admin', requireRole('ADMIN'), walletController.adminListWallets);
router.get('/admin/stats', requireRole('ADMIN'), walletController.adminStats);
router.get('/admin/transactions', requireRole('ADMIN'), walletController.adminAllTransactions);
router.get('/admin/user/:userId', requireRole('ADMIN'), walletController.adminGetWallet);
router.post('/admin/topup', requireRole('ADMIN'), walletController.adminTopUp);

module.exports = router;
