import jwt from 'jsonwebtoken';
import { getMarket } from '../config/exchanges.js';
import User from '../models/User.js';
import config from '../config/config.js';

// Verify JWT token and attach user to request
export const authenticate = async (req, res, next) => {
  try {
    // Get token from header or cookie
    let token = null;
    
    // Check Authorization header (Bearer token)
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    }
    
    // Check cookie as fallback
    if (!token && req.cookies && req.cookies.token) {
      token = req.cookies.token;
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required. Please log in.'
      });
    }

    // Verify token
    const decoded = jwt.verify(token, config.jwtSecret);
    
    // Get user from database
    const user = await User.findById(decoded.userId).select('-password');
    
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User not found. Please log in again.'
      });
    }

    // Check if user account is active
    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: 'Your account is not active. Please wait for admin approval.'
      });
    }

    // Attach user to request
    req.user = user;

    // Resolved once, here, so no service has to work out which market it is in
    // from a portfolio's currency. A request header can override it for a single
    // call, which is what lets the client switch without a round trip to save.
    req.market = getMarket(req.headers['x-market'] || user.activeMarket).code;
    next();
  } catch (error) {
    console.error('Authentication error:', error);
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Invalid token. Please log in again.'
      });
    }
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token expired. Please log in again.'
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Authentication failed',
      error: error.message
    });
  }
};

// Check if user is admin or super_admin
export const requireAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required'
    });
  }

  if (req.user.role !== 'admin' && req.user.role !== 'super_admin') {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Admin privileges required.'
    });
  }

  next();
};

// Check if user is super_admin
export const requireSuperAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required'
    });
  }

  if (req.user.role !== 'super_admin') {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Super Admin privileges required.'
    });
  }

  next();
};

// Combined middleware: authenticate + requireAdmin
export const adminOnly = [authenticate, requireAdmin];

// Combined middleware: authenticate + requireSuperAdmin  
export const superAdminOnly = [authenticate, requireSuperAdmin];

