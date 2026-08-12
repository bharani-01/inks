const express = require('express');
const router = express.Router();
const authenticate = require('../middleware/auth');
const requireRole = require('../middleware/roleCheck');
const {
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
} = require('../controllers/user.controller');

// All routes require authentication
router.use(authenticate);

// User routes (any authenticated user)
router.get('/profile', getProfile);
router.put('/profile', updateProfile);
router.put('/change-password', changePassword);
router.get('/email-preferences', getEmailPreferences);
router.put('/email-preferences', updateEmailPreferences);

// Admin-only routes
router.get('/stats', requireRole('ADMIN'), getUserStats);
router.get('/', requireRole('ADMIN'), getAllUsers);
router.post('/', requireRole('ADMIN'), createUser);
router.get('/:id', requireRole('ADMIN'), getUserById);
router.put('/:id', requireRole('ADMIN'), updateUser);
router.delete('/:id', requireRole('ADMIN'), deleteUser);
router.put('/:id/toggle-status', requireRole('ADMIN'), toggleUserStatus);

module.exports = router;
