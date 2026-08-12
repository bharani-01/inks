const crypto = require('crypto');
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
      { expiresIn: '24h' }
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
      { expiresIn: '24h' }
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
 * Initiate Google OAuth 2.0 Backend Handshake
 * GET /api/auth/google/redirect
 */
async function googleRedirect(req, res) {
  try {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    if (!clientId) {
      return res.status(500).json({ message: 'Google Client ID is not configured in .env' });
    }

    const appOrigin = getSafeAppOrigin(req);
    const redirectUri = `${appOrigin}/api/auth/google/callback`;

    const googleAuthUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    googleAuthUrl.searchParams.set('client_id', clientId);
    googleAuthUrl.searchParams.set('redirect_uri', redirectUri);
    googleAuthUrl.searchParams.set('response_type', 'code');
    googleAuthUrl.searchParams.set('scope', 'openid email profile');
    googleAuthUrl.searchParams.set('access_type', 'online');
    googleAuthUrl.searchParams.set('prompt', 'select_account');

    // Strict validation of destination URL against hardcoded Google Accounts domain
    if (googleAuthUrl.protocol === 'https:' && googleAuthUrl.hostname === 'accounts.google.com') {
      return res.redirect(googleAuthUrl.toString());
    }
    return res.status(400).json({ message: 'Invalid OAuth destination origin' });
  } catch (err) {
    console.error('GoogleRedirect error:', err);
    res.status(500).json({ message: 'Failed to initiate Google OAuth handshake' });
  }
}

/**
 * Handle Google OAuth 2.0 Backend Callback Handshake
 * GET /api/auth/google/callback?code=...
 */
async function googleCallback(req, res) {
  try {
    const { code, error } = req.query;

    if (error || !code) {
      return safeRedirect(res, `/login?error=${encodeURIComponent(error || 'Google authorization cancelled')}`, req);
    }

    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET || '';
    const appOrigin = getSafeAppOrigin(req);
    const redirectUri = `${appOrigin}/api/auth/google/callback`;

    // 1. Backend Handshake: Exchange code directly with Google OAuth Token API
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    const tokenData = await tokenRes.json();

    if (!tokenRes.ok || (!tokenData.access_token && !tokenData.id_token)) {
      console.error('Google token exchange error:', tokenData);
      return safeRedirect(res, `/login?error=${encodeURIComponent(tokenData.error_description || 'Google token exchange failed')}`, req);
    }

    // 2. Fetch User Profile directly from Google
    let profile = {};
    if (tokenData.access_token) {
      const userinfoRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      });
      profile = await userinfoRes.json();
    } else if (tokenData.id_token) {
      const parts = tokenData.id_token.split('.');
      profile = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
    }

    const targetEmail = profile.email ? profile.email.toLowerCase().trim() : null;
    const targetName = profile.name || 'Google User';
    const targetPicture = profile.picture || null;
    const googleSub = profile.sub || null;

    if (!targetEmail) {
      return safeRedirect(res, `/login?error=${encodeURIComponent('No email returned from Google account')}`, req);
    }

    // 3. User Lookup & Auto-Registration
    let user = await prisma.user.findFirst({
      where: {
        OR: [
          ...(googleSub ? [{ googleId: googleSub }] : []),
          { email: targetEmail },
        ],
      },
    });

    if (user) {
      if (!user.isActive) {
        return safeRedirect(res, `/login?pendingApproval=true&email=${encodeURIComponent(targetEmail)}`, req);
      }
      if (!user.googleId || !user.avatarUrl) {
        user = await prisma.user.update({
          where: { id: user.id },
          data: {
            googleId: user.googleId || googleSub,
            avatarUrl: user.avatarUrl || targetPicture,
          },
        });
      }
    } else {
      const dummyHash = await bcrypt.hash(crypto.randomUUID ? crypto.randomUUID() : String(Date.now()), 10);
      user = await prisma.user.create({
        data: {
          name: targetName,
          email: targetEmail,
          passwordHash: dummyHash,
          avatarUrl: targetPicture,
          googleId: googleSub,
          role: 'USER',
          isActive: false, // Requires Admin Approval
        },
      });

      try {
        await prisma.wallet.upsert({
          where: { userId: user.id },
          create: { userId: user.id, balance: 0 },
          update: {},
        });
      } catch (wErr) {}

      return safeRedirect(res, `/login?pendingApproval=true&email=${encodeURIComponent(targetEmail)}`, req);
    }

    // 4. Sign JWT & send popup success postMessage script
    const token = jwt.sign(
      { id: user.id, role: user.role, email: user.email, name: user.name },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    const targetUserJson = {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      isActive: user.isActive,
      avatarUrl: user.avatarUrl,
    };

    res.send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Google Sign-In</title>
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #fafafa; color: #111827; }
            .card { background: white; padding: 24px 32px; border-radius: 16px; border: 1px solid #e5e7eb; box-shadow: 0 4px 12px rgba(0,0,0,0.05); text-align: center; }
            .spinner { width: 24px; height: 24px; border: 3px solid #e5e7eb; border-top-color: #2563eb; border-radius: 50%; animation: spin 0.8s linear infinite; margin: 12px auto; }
            @keyframes spin { to { transform: rotate(360deg); } }
          </style>
        </head>
        <body>
          <div class="card">
            <div class="spinner"></div>
            <h3 style="margin: 8px 0 4px; font-size: 16px;">Google Sign-In Successful</h3>
            <p style="margin: 0; font-size: 13px; color: #6b7280;">Completing authentication...</p>
          </div>
          <script>
            (function() {
              var payload = {
                type: 'GOOGLE_AUTH_SUCCESS',
                token: ${JSON.stringify(token)},
                user: ${JSON.stringify(targetUserJson)}
              };
              if (window.opener) {
                window.opener.postMessage(payload, ${JSON.stringify(appOrigin)});
                setTimeout(function() { window.close(); }, 300);
              } else {
                window.location.href = "${appOrigin}/login?auth_token=${token}&user=${encodeURIComponent(JSON.stringify(targetUserJson))}";
              }
            })();
          </script>
        </body>
      </html>
    `);
  } catch (err) {
    console.error('GoogleCallback error:', err);
    safeRedirect(res, `/login?error=${encodeURIComponent('Failed to complete Google Sign-In')}`, req);
  }
}

/**
 * Handle Direct Google One-Tap / ID Token Sign-In
 * POST /api/auth/google
 * Body: { credential, email, name, picture, sub }
 */
async function googleLogin(req, res) {
  try {
    const { credential, email, name, picture, sub } = req.body;

    let targetEmail = email ? email.toLowerCase().trim() : null;
    let targetName = name || 'Google User';
    let targetPicture = picture || null;
    let googleSub = sub || null;

    // Decode Google JWT credential if provided
    if (credential) {
      try {
        const parts = credential.split('.');
        if (parts.length === 3) {
          const payloadJson = Buffer.from(parts[1], 'base64url').toString('utf8');
          const payload = JSON.parse(payloadJson);
          if (payload.email) targetEmail = payload.email.toLowerCase().trim();
          if (payload.name) targetName = payload.name;
          if (payload.picture) targetPicture = payload.picture;
          if (payload.sub) googleSub = payload.sub;
        }
      } catch (jwtErr) {
        console.warn('Google JWT parse warning:', jwtErr.message);
      }
    }

    if (!targetEmail) {
      return res.status(400).json({ message: 'Valid Google email is required' });
    }

    // 1. Find existing user by googleId or email
    let user = await prisma.user.findFirst({
      where: {
        OR: [
          ...(googleSub ? [{ googleId: googleSub }] : []),
          { email: targetEmail },
        ],
      },
    });

    if (user) {
      if (!user.isActive) {
        return res.status(403).json({
          message: 'Your account is pending administrator approval. Please contact an administrator.',
          pendingApproval: true,
        });
      }

      if (!user.googleId || !user.avatarUrl) {
        user = await prisma.user.update({
          where: { id: user.id },
          data: {
            googleId: user.googleId || googleSub,
            avatarUrl: user.avatarUrl || targetPicture,
          },
        });
      }
    } else {
      // 2. Register new user via Google (Requires Admin Approval)
      const dummyHash = await bcrypt.hash(crypto.randomUUID ? crypto.randomUUID() : String(Date.now()), 10);
      user = await prisma.user.create({
        data: {
          name: targetName,
          email: targetEmail,
          passwordHash: dummyHash,
          avatarUrl: targetPicture,
          googleId: googleSub,
          role: 'USER',
          isActive: false, // Requires Admin Approval
        },
      });

      // Lazy initialize wallet
      try {
        await prisma.wallet.upsert({
          where: { userId: user.id },
          create: { userId: user.id, balance: 0 },
          update: {},
        });
      } catch (wErr) {
        console.warn('Failed to initialize wallet for new Google user:', wErr.message);
      }

      return res.status(201).json({
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          isActive: false,
        },
        pendingApproval: true,
        message: 'Account created with Google! Your account is pending administrator approval before you can sign in.',
      });
    }

    // Sign session JWT
    const token = jwt.sign(
      { id: user.id, role: user.role, email: user.email, name: user.name },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
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
      message: 'Google Sign-In successful!',
    });
  } catch (err) {
    console.error('GoogleLogin error:', err);
    res.status(500).json({ message: 'Failed to authenticate with Google' });
  }
}

module.exports = {
  register,
  login,
  googleRedirect,
  googleCallback,
  googleLogin,
  getMe,
  sendOtp,
  verifyOtp,
  forgotPassword,
  resetPassword,
};
