const jwt = require('jsonwebtoken');
const { User } = require('../models');
const { errorResponse } = require('../utils/response');
const logger = require('../utils/logger');
const config = require('../config/env');

const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return errorResponse(res, 'Access token required', 401);
    }

    const decoded = jwt.verify(token, config.jwt.accessSecret);
    
    const user = await User.findByPk(decoded.userId, {
      attributes: { exclude: ['passwordHash', 'verificationTokenHash', 'resetPasswordTokenHash'] },
    });

    // User not found in database
    if (!user) {
      return errorResponse(res, 'User not found', 404);
    }

    // Only block suspended and inactive users from accessing the app
    // Allow pending and active users to access dashboard
    if (user.status === 'suspended') {
      return errorResponse(res, 'Account suspended. Please contact support.', 403);
    }

    if (user.status === 'inactive') {
      return errorResponse(res, 'Account inactive. Please contact support.', 403);
    }

    req.user = user;
    next();
  } catch (error) {
    logger.error('Authentication error:', error);
    
    if (error.name === 'TokenExpiredError') {
      return errorResponse(res, 'Token expired', 401);
    }
    
    if (error.name === 'JsonWebTokenError') {
      return errorResponse(res, 'Invalid token', 401);
    }
    
    return errorResponse(res, 'Authentication failed', 401);
  }
};

const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return next();
    }

    const decoded = jwt.verify(token, config.jwt.accessSecret);
    const user = await User.findByPk(decoded.userId, {
      attributes: { exclude: ['passwordHash', 'verificationTokenHash', 'resetPasswordTokenHash'] },
    });

    // For optional auth, we still set req.user even if suspended
    // Individual routes can check status if needed
    if (user) {
      req.user = user;
    }

    next();
  } catch (error) {
    // For optional auth, we just continue without setting req.user
    next();
  }
};

module.exports = {
  authenticateToken,
  optionalAuth,
};