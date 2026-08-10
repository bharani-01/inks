const express = require('express');
const router = express.Router();
const authenticate = require('../middleware/auth');
const { getNotifications, markAsRead, markAllAsRead } = require('../controllers/notification.controller');

router.use(authenticate);

router.get('/', getNotifications);
router.put('/:id/read', markAsRead);
router.put('/read-all', markAllAsRead);

module.exports = router;
