const express = require('express');
const router = express.Router();
const {
  register,
  login,
  googleLogin,
  getMe,
  sendOtp,
  verifyOtp,
  forgotPassword,
  resetPassword,
} = require('../controllers/auth.controller');
const authenticate = require('../middleware/auth');

// Public routes
router.post('/register', register);
router.post('/login', login);
router.post('/google', googleLogin);
router.post('/send-otp', sendOtp);
router.post('/verify-otp', verifyOtp);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);

// Protected route
router.get('/me', authenticate, getMe);

module.exports = router;
