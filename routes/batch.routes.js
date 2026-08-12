const express = require('express');
const router = express.Router();
const authenticate = require('../middleware/auth');
const { createBatchOrder, getUserBatchOrders, getBatchOrderById } = require('../controllers/batch.controller');

router.use(authenticate);

router.post('/', createBatchOrder);
router.get('/', getUserBatchOrders);
router.get('/:id', getBatchOrderById);

module.exports = router;
