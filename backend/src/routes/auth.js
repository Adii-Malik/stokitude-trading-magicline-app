import express from 'express';
import { MARKET_CODES, MARKETS, marketOfCurrency } from '../config/exchanges.js';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import config from '../config/config.js';
import { authenticate } from '../middleware/auth.js';
import emailService from '../services/emailService.js';
import Portfolio from '../models/Portfolio.js';
import portfolioService from '../services/portfolioService.js';

const router = express.Router();

// Generate JWT token
const generateToken = (userId) => {
  return jwt.sign(
    { userId },
    config.jwtSecret,
    { expiresIn: config.jwtExpiresIn }
  );
};

// POST /api/auth/signup - Register new user
router.post('/signup', async (req, res) => {
  try {
    const { username, email, password } = req.body;

    // Validate input
    if (!username || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide username, email, and password'
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({
      $or: [{ email }, { username }]
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: existingUser.email === email
          ? 'Email already registered'
          : 'Username already taken'
      });
    }

    // All new signups are regular users (role and isActive set by default)
    // Only super_admin can promote users to admin
    const user = new User({
      username,
      email,
      password
      // role: 'user' (default)
      // isActive: false (default)
    });

    await user.save();

    // ⚠️ DON'T generate token or set cookie for inactive users
    // They need admin approval first

    console.log(`✅ New user registered: ${username} (${email}) - Pending approval`);

    res.status(201).json({
      success: true,
      message: 'Account created successfully! Please wait for admin approval before you can log in.',
      data: {
        user: user.toSafeObject(),
        pendingApproval: true
      }
    });

  } catch (error) {
    console.error('❌ Signup error:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating user',
      error: error.message
    });
  }
});

// POST /api/auth/login - Login user
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate input
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide email and password'
      });
    }

    // Find user and include password
    const user = await User.findOne({ email }).select('+password');

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    // Check password
    const isPasswordValid = await user.comparePassword(password);

    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    // Check if user account is active
    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: 'Your account is pending admin approval. Please wait for activation.'
      });
    }

    // Generate token
    const token = generateToken(user._id);

    // Set cookie
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      sameSite: 'lax'
    });

    console.log(`✅ User logged in: ${user.username} (${user.role})`);

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        user: user.toSafeObject(),
        token
      }
    });

  } catch (error) {
    console.error('❌ Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Error logging in',
      error: error.message
    });
  }
});

// POST /api/auth/logout - Logout user
router.post('/logout', (req, res) => {
  res.clearCookie('token');
  res.json({
    success: true,
    message: 'Logged out successfully'
  });
});

// GET /api/auth/me - Get current user
router.get('/me', authenticate, async (req, res) => {
  try {
    // Which markets this user actually trades in, so the client can hide a
    // switch that has only one option. Derived from the books rather than
    // stored, because opening a US account is how you gain the US market.
    const books = await Portfolio.find({
      $or: [{ owner: req.user._id }, { 'sharedWith.user': req.user._id }],
      isActive: true
    }).select('currency').lean();

    const held = [...new Set(books.map(b => marketOfCurrency(b.currency)))];

    res.json({
      success: true,
      data: {
        user: req.user,
        markets: {
          active: req.market,
          // The active one is always listed, even before its first book exists.
          held: MARKET_CODES.filter(code => held.includes(code) || code === req.market)
            .map(code => ({ code, name: MARKETS[code].name, currency: MARKETS[code].currency }))
        }
      }
    });
  } catch (error) {
    console.error('❌ Error fetching user:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching user data',
      error: error.message
    });
  }
});

// GET /api/auth/check - Quick auth check (no user data)
/**
 * Which market the app is scoped to.
 *
 * Stored on the user rather than held in the browser, so the choice survives a
 * new device and the server can scope a request without being told twice. Also
 * reports which markets the user actually holds books in - a switch with one
 * option is a switch worth hiding.
 */
router.put('/market', authenticate, async (req, res) => {
  try {
    const wanted = String(req.body.market || '').toUpperCase();
    if (!MARKET_CODES.includes(wanted)) {
      return res.status(400).json({
        success: false,
        message: `Unknown market. Expected one of ${MARKET_CODES.join(', ')}.`
      });
    }

    req.user.activeMarket = wanted;
    await req.user.save();

    res.json({ success: true, data: { activeMarket: wanted } });
  } catch (error) {
    console.error('Set market error:', error);
    res.status(500).json({ success: false, message: 'Failed to change market' });
  }
});

router.get('/check', authenticate, (req, res) => {
  res.json({
    success: true,
    authenticated: true,
    role: req.user.role
  });
});

// PUT /api/auth/change-password - Change password
router.put('/change-password', authenticate, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    // Validate input
    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Please provide current and new password'
      });
    }

    // Validate new password length
    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'New password must be at least 6 characters long'
      });
    }

    // Get user with password
    const user = await User.findById(req.user._id).select('+password');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Verify current password
    const isPasswordValid = await user.comparePassword(currentPassword);

    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Current password is incorrect'
      });
    }

    // Update password
    user.password = newPassword;
    await user.save();

    console.log(`✅ Password changed for user: ${user.username}`);

    res.json({
      success: true,
      message: 'Password changed successfully'
    });

  } catch (error) {
    console.error('❌ Change password error:', error);
    res.status(500).json({
      success: false,
      message: 'Error changing password',
      error: error.message
    });
  }
});

// PUT /api/auth/update-profile - Update user profile
router.put('/update-profile', authenticate, async (req, res) => {
  try {
    const { username, filerStatus } = req.body;

    // Validate input
    if (!username) {
      return res.status(400).json({
        success: false,
        message: 'Please provide username to update'
      });
    }

    if (filerStatus !== undefined && !['FILER', 'NON_FILER'].includes(filerStatus)) {
      return res.status(400).json({
        success: false,
        message: 'filerStatus must be FILER or NON_FILER'
      });
    }

    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check if username is already taken by another user
    if (username !== user.username) {
      const existingUser = await User.findOne({ username });
      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: 'Username already taken'
        });
      }
      user.username = username;
    }

    // Rates hang off filer status, and CGT is stored on every position. Changing
    // it without rebuilding leaves each portfolio showing tax at the old rate
    // until some unrelated edit happens to recalculate it.
    const filerChanged = filerStatus !== undefined && filerStatus !== user.filerStatus;
    if (filerStatus !== undefined) {
      user.filerStatus = filerStatus;
    }

    await user.save();

    if (filerChanged) {
      const owned = await Portfolio.find({ owner: user._id, isActive: true }).select('_id').lean();
      // Best effort: the profile change itself has already been saved, so one
      // portfolio failing to rebuild must not report the whole update as failed.
      await Promise.all(owned.map(p =>
        portfolioService.rebuildPositions(p._id, user._id)
          .catch(err => console.error(`Failed to rebuild ${p._id} after filer change:`, err.message))
      ));
      console.log(`♻️  Rebuilt ${owned.length} portfolio(s) for filer status ${filerStatus}`);
    }

    console.log(`✅ Profile updated for user: ${user.username}`);

    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: {
        user: user.toSafeObject()
      }
    });

  } catch (error) {
    console.error('❌ Update profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating profile',
      error: error.message
    });
  }
});

// POST /api/auth/forgot-password - Request password reset
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Please provide your email'
      });
    }

    const user = await User.findOne({ email });

    if (!user) {
      // Don't reveal if user exists
      return res.json({
        success: true,
        message: 'If your email is registered, you will receive a password reset link shortly.'
      });
    }

    // Generate reset token (simple implementation - for production use crypto)
    const resetToken = Math.random().toString(36).substring(2, 15) +
      Math.random().toString(36).substring(2, 15);

    user.resetPasswordToken = resetToken;
    user.resetPasswordExpires = Date.now() + 3600000; // 1 hour
    await user.save();

    console.log(`✅ Password reset requested for: ${user.email}`);
    console.log(`   Reset token: ${resetToken} (expires in 1 hour)`);

    // Send password reset email
    try {
      await emailService.sendPasswordResetEmail(user.email, user.username, resetToken);
    } catch (emailError) {
      console.error('Failed to send reset email:', emailError.message);
      // Don't fail the request if email fails
    }

    res.json({
      success: true,
      message: 'If your email is registered, you will receive a password reset link shortly.'
    });

  } catch (error) {
    console.error('❌ Forgot password error:', error);
    res.status(500).json({
      success: false,
      message: 'Error processing password reset request',
      error: error.message
    });
  }
});

// POST /api/auth/reset-password - Reset password with token
router.post('/reset-password', async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Please provide reset token and new password'
      });
    }

    // Validate new password length
    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters long'
      });
    }

    // Find user with valid token
    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: Date.now() }
    }).select('+resetPasswordToken +resetPasswordExpires');

    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'Password reset token is invalid or has expired'
      });
    }

    // Update password and clear reset token
    user.password = newPassword;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    console.log(`✅ Password reset successful for user: ${user.username}`);

    res.json({
      success: true,
      message: 'Password has been reset successfully. You can now login with your new password.'
    });

  } catch (error) {
    console.error('❌ Reset password error:', error);
    res.status(500).json({
      success: false,
      message: 'Error resetting password',
      error: error.message
    });
  }
});

export default router;

