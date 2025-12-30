const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authenticateToken } = require('../middleware/authMiddleware');
const { authLimiter, passwordResetLimiter } = require('../middleware/rateLimitMiddleware');

// Public routes
router.post('/register', authLimiter, authController.register);
router.post('/login', authLimiter, authController.login);
router.post('/refresh-token', authController.refreshToken);
router.get('/verify-email', authController.verifyEmail);
router.post('/forgot-password', passwordResetLimiter, authController.forgotPassword);
router.post('/reset-password', authController.resetPassword);
router.post('/2fa/verify', authLimiter, authController.verifyTwoFactor);

// Protected routes
router.post('/logout', authenticateToken, authController.logout);
router.get('/me', authenticateToken, authController.getMe);
router.post('/resend-verification', authenticateToken, authController.resendVerificationEmail);
router.post('/change-password', authenticateToken, authController.changePassword);
router.post('/2fa/enable', authenticateToken, authController.enableTwoFactor);
router.post('/2fa/disable', authenticateToken, authController.disableTwoFactor);

module.exports = router;