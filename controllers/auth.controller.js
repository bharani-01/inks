const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('../config/db');

const TRUSTED_DOMAINS = new Set([
  'inks.trackifyapp.co.in',
  'mail.trackifyapp.co.in',
  'trackifyapp.co.in',
  'localhost',
  '127.0.0.1',
]);

/**
 * Validates and resolves a safe application client origin against an approved allowlist
 * to prevent Host Header Injection and Open Redirect attacks.
 */
function getSafeAppOrigin(req) {
  const configured = (process.env.CLIENT_URL || process.env.APP_URL || '').trim();
  if (configured) {
    try {
      const parsed = new URL(configured);
      if (TRUSTED_DOMAINS.has(parsed.hostname) || parsed.hostname.endsWith('.trackifyapp.co.in')) {
        return parsed.origin;
      }
    } catch {}
  }
  const host = (req && req.get && req.get('host')) || '';
  if (host) {
    try {
      const parsed = new URL(`http://${host}`);
      if (TRUSTED_DOMAINS.has(parsed.hostname) || parsed.hostname.endsWith('.trackifyapp.co.in')) {
        const protocol = (req && req.headers && req.headers['x-forwarded-proto']) || (req && req.protocol) || 'http';
        return `${protocol}://${host}`.replace(/\/$/, '');
      }
    } catch {}
  }
  return 'https://inks.trackifyapp.co.in';
}

/**
 * Open Redirect Guard: Guarantees that redirects only point to relative paths
 * on the verified, allowlisted application origin.
 */
function safeRedirect(res, pathAndQuery, req) {
  const base = getSafeAppOrigin(req);
  const targetPath = typeof pathAndQuery === 'string' && pathAndQuery.startsWith('/') && !pathAndQuery.startsWith('//')
    ? pathAndQuery
    : '/login';
  
  const parsedTarget = new URL(targetPath, base);
  // Guarantee destination host is in the trusted domain allowlist
  if (TRUSTED_DOMAINS.has(parsedTarget.hostname) || parsedTarget.hostname.endsWith('.trackifyapp.co.in')) {
    return res.redirect(parsedTarget.toString());
  }
  return res.redirect('https://inks.trackifyapp.co.in/login');
}

/**
 * Register a new user
 * POST /api/auth/register
 */
async function register(req, res) {
  try {
    const { name, email, phone, password } = req.body;

    // Validation
    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Name, email, and password are required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters' });
    }

    // Check duplicate email
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res.status(409).json({ message: 'Email already exists' });
    }

    // Hash password and create user with isActive: false (pending admin approval)
    const passwordHash = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: {
        name,
        email: email.toLowerCase().trim(),
        phone: phone || null,
        passwordHash,
        isActive: false, // Requires admin approval before login
      },
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

    res.status(201).json({
      user,
      pendingApproval: true,
      message: 'Account created successfully! Your account is pending administrator approval before you can sign in.',
    });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
}

/**
 * Login user
 * POST /api/auth/login
 */
async function login(req, res) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    // Find user
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    });

    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    // Check password
    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    // Check if active / approved
    if (!user.isActive) {
      return res.status(403).json({
        message: 'Your account is pending administrator approval. Please wait for an administrator to activate your account.',
        pendingApproval: true,
      });
    }

    // Sign JWT
    const token = jwt.sign(
      { id: user.id, role: user.role, email: user.email, name: user.name },
      process.env.JWT_SECRET,
      { expiresIn: user.role === 'PRINTER_AGENT' ? '30d' : '24h' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        isActive: user.isActive,
        createdAt: user.createdAt,
      },
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
}

/**
 * Get current authenticated user
 * GET /api/auth/me
 */
async function getMe(req, res) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
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

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({ user });
  } catch (err) {
    console.error('GetMe error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
}

/**
 * Send OTP for Login
 * POST /api/auth/send-otp
 */
async function sendOtp(req, res) {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: 'Email address is required' });
    }

    const cleanEmail = email.toLowerCase().trim();

    // Check user exists
    const user = await prisma.user.findUnique({
      where: { email: cleanEmail },
    });

    if (!user) {
      return res.status(404).json({ message: 'No account found with this email address' });
    }

    if (!user.isActive) {
      return res.status(403).json({
        message: 'Your account is pending administrator approval. Please wait for an admin to activate your account.',
        pendingApproval: true,
      });
    }

    // Generate 6 digit code
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Invalidate old OTPs for this email & purpose
    await prisma.otpCode.updateMany({
      where: { email: cleanEmail, purpose: 'LOGIN', isUsed: false },
      data: { isUsed: true },
    });

    // Save new OTP
    await prisma.otpCode.create({
      data: {
        email: cleanEmail,
        code,
        purpose: 'LOGIN',
        expiresAt,
      },
    });

    // Dispatch email
    const { sendOtpLoginEmail } = require('../services/email.service');
    await sendOtpLoginEmail({
      to: cleanEmail,
      name: user.name,
      code,
    });

    res.json({
      message: `A 6-digit verification code has been sent to ${cleanEmail}.`,
    });
  } catch (err) {
    console.error('SendOtp error:', err);
    res.status(500).json({ message: 'Failed to send verification code' });
  }
}

/**
 * Verify OTP and sign in user
 * POST /api/auth/verify-otp
 */
async function verifyOtp(req, res) {
  try {
    const { email, code } = req.body;

    if (!email || !code) {
      return res.status(400).json({ message: 'Email and verification code are required' });
    }

    const cleanEmail = email.toLowerCase().trim();
    const cleanCode = code.toString().trim();

    // Find valid OTP
    const validOtp = await prisma.otpCode.findFirst({
      where: {
        email: cleanEmail,
        code: cleanCode,
        purpose: 'LOGIN',
        isUsed: false,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!validOtp) {
      return res.status(400).json({ message: 'Invalid or expired verification code' });
    }

    // Mark as used
    await prisma.otpCode.update({
      where: { id: validOtp.id },
      data: { isUsed: true },
    });

    // Fetch user
    const user = await prisma.user.findUnique({
      where: { email: cleanEmail },
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

    if (!user) {
      return res.status(404).json({ message: 'User account not found' });
    }

    if (!user.isActive) {
      return res.status(403).json({
        message: 'Your account is pending administrator approval.',
        pendingApproval: true,
      });
    }

    // Sign JWT
    const token = jwt.sign(
      { id: user.id, role: user.role, email: user.email, name: user.name },
      process.env.JWT_SECRET,
      { expiresIn: user.role === 'PRINTER_AGENT' ? '30d' : '24h' }
    );

    res.json({
      token,
      user,
      message: 'Signed in successfully',
    });
  } catch (err) {
    console.error('VerifyOtp error:', err);
    res.status(500).json({ message: 'Failed to verify OTP' });
  }
}

/**
 * Request Password Reset Code
 * POST /api/auth/forgot-password
 */
async function forgotPassword(req, res) {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: 'Email address is required' });
    }

    const cleanEmail = email.toLowerCase().trim();

    const user = await prisma.user.findUnique({
      where: { email: cleanEmail },
    });

    if (!user) {
      // Return 200 for security to prevent email enumeration, but with a generic message
      return res.json({
        message: 'If an account exists with that email, a password reset code has been sent.',
      });
    }

    // Generate 6 digit code
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 mins

    await prisma.otpCode.updateMany({
      where: { email: cleanEmail, purpose: 'PASSWORD_RESET', isUsed: false },
      data: { isUsed: true },
    });

    await prisma.otpCode.create({
      data: {
        email: cleanEmail,
        code,
        purpose: 'PASSWORD_RESET',
        expiresAt,
      },
    });

    const { sendPasswordResetEmail } = require('../services/email.service');
    await sendPasswordResetEmail({
      to: cleanEmail,
      name: user.name,
      code,
    });

    res.json({
      message: 'If an account exists with that email, a password reset code has been sent.',
    });
  } catch (err) {
    console.error('ForgotPassword error:', err);
    res.status(500).json({ message: 'Failed to process password reset request' });
  }
}

/**
 * Verify Reset Code and Set New Password
 * POST /api/auth/reset-password
 */
async function resetPassword(req, res) {
  try {
    const { email, code, newPassword } = req.body;

    if (!email || !code || !newPassword) {
      return res.status(400).json({ message: 'Email, code, and new password are required' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ message: 'New password must be at least 6 characters' });
    }

    const cleanEmail = email.toLowerCase().trim();
    const cleanCode = code.toString().trim();

    // Verify OTP
    const validOtp = await prisma.otpCode.findFirst({
      where: {
        email: cleanEmail,
        code: cleanCode,
        purpose: 'PASSWORD_RESET',
        isUsed: false,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!validOtp) {
      return res.status(400).json({ message: 'Invalid or expired password reset code' });
    }

    // Invalidate OTP
    await prisma.otpCode.update({
      where: { id: validOtp.id },
      data: { isUsed: true },
    });

    // Hash and update password
    const passwordHash = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({
      where: { email: cleanEmail },
      data: { passwordHash },
    });

    res.json({
      message: 'Password reset successful! You can now log in with your new password.',
    });
  } catch (err) {
    console.error('ResetPassword error:', err);
    res.status(500).json({ message: 'Failed to reset password' });
  }
}

/**
 * Google Sign-In / OAuth 2.0 Handler
 * POST /api/auth/google
 */
async function googleLogin(req, res) {
  try {
    const { credential, idToken } = req.body;
    const tokenToVerify = credential || idToken;

    if (!tokenToVerify) {
      return res.status(400).json({ message: 'Google authentication credential is required' });
    }

    // Decode JWT payload from Google Identity Services ID Token
    let googleSub = null;
    let targetEmail = null;
    let targetName = null;
    let targetPicture = null;

    try {
      const parts = String(tokenToVerify).split('.');
      if (parts.length === 3) {
        const payloadJson = Buffer.from(parts[1], 'base64').toString('utf8');
        const payload = JSON.parse(payloadJson);
        if (payload.email) targetEmail = payload.email.toLowerCase().trim();
        if (payload.name) targetName = payload.name;
        if (payload.picture) targetPicture = String(payload.picture).slice(0, 500);
        if (payload.sub) googleSub = payload.sub;
      }
    } catch (jwtErr) {
      console.warn('Google JWT decode warning:', jwtErr.message);
    }

    if (!targetEmail) {
      return res.status(400).json({ message: 'Could not extract valid email from Google credential' });
    }

    // Find user by email or googleId
    let user = await prisma.user.findFirst({
      where: {
        OR: [
          { email: targetEmail },
          ...(googleSub ? [{ googleId: googleSub }] : []),
        ],
      },
    });

    if (!user) {
      // Create new user for Google Sign In
      user = await prisma.user.create({
        data: {
          name: targetName || 'Google User',
          email: targetEmail,
          googleId: googleSub,
          avatarUrl: targetPicture,
          isActive: true, // Google accounts are pre-verified by Google
        },
      });
    } else if (!user.googleId && googleSub) {
      // Link existing account with googleId
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          googleId: googleSub,
          avatarUrl: user.avatarUrl || targetPicture,
          isActive: true,
        },
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        message: 'Your account is currently disabled. Please contact an administrator.',
      });
    }

    // Sign JWT
    const token = jwt.sign(
      { id: user.id, role: user.role, email: user.email, name: user.name },
      process.env.JWT_SECRET,
      { expiresIn: user.role === 'PRINTER_AGENT' ? '30d' : '24h' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        isActive: user.isActive,
        avatarUrl: user.avatarUrl,
        createdAt: user.createdAt,
      },
      message: 'Signed in successfully with Google',
    });
  } catch (err) {
    console.error('Google login error:', err);
    res.status(500).json({ message: 'Google authentication failed' });
  }
}

module.exports = {
  register,
  login,
  googleLogin,
  getMe,
  sendOtp,
  verifyOtp,
  forgotPassword,
  resetPassword,
  safeRedirect,
  getSafeAppOrigin,
};
