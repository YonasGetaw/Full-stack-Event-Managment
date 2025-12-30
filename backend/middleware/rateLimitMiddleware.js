const rateLimit = require('express-rate-limit');

// General rate limiter
const generalLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 15 minutes
  max: 20000, // limit each IP to 100 requests per windowMs
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Auth rate limiter (stricter)
const authLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 15 minutes
  max: 200, // limit each IP to 5 login attempts per windowMs
  message: {
    success: false, 
    message: 'Too many login attempts, please try again later.',
  },
  skipSuccessfulRequests: true, // Don't count successful requests
  standardHeaders: true,
  legacyHeaders: false,
});

// Password reset limiter
const passwordResetLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 3 password reset requests per windowMs
  message: {
    success: false,
    message: 'Too many password reset attempts, please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// API key-based rate limiting (for future use)
const apiKeyLimiter = (maxRequests, windowMs) => {
  return rateLimit({
    windowMs,
    max: maxRequests,
    keyGenerator: (req) => {
      return req.headers['x-api-key'] || req.ip;
    },
    message: {
      success: false,
      message: 'API rate limit exceeded',
    },
    standardHeaders: true,
    legacyHeaders: false,
  });
};

module.exports = {
  generalLimiter,
  authLimiter,
  passwordResetLimiter,
  apiKeyLimiter,
};