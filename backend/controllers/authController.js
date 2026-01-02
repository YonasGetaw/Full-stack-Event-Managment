const jwt = require('jsonwebtoken');
const Joi = require('joi');
const { User, AuditLog } = require('../models');
const { successResponse, errorResponse, validationErrorResponse } = require('../utils/response');
const { generateOTP, generateToken, hashToken, verifyToken, generateExpiryTime, isTokenExpired } = require('../utils/otp');

const EmailService = require('../services/emailService');
const NotificationService = require('../services/notificationService');
const logger = require('../utils/logger');
const config = require('../config/env');
const { Sequelize } = require('sequelize');

const getProfileImageUrl = (profileImage) => {
  if (!profileImage) return null;
  // If it's already a full URL, return as is
  if (profileImage.startsWith('http')) return profileImage;
  // If it's a relative path starting with /uploads, construct full URL
  const baseUrl = process.env.NODE_ENV === 'production' 
    ? (process.env.FRONTEND_URL || 'http://localhost:5173')
    : 'http://localhost:4001';
  return profileImage.startsWith('/') ? `${baseUrl}${profileImage}` : `${baseUrl}/${profileImage}`;
};

// Validation schemas
const registerSchema = Joi.object({
  firstName: Joi.string().min(2).max(50).required(),
  lastName: Joi.string().min(2).max(50).required(),
  email: Joi.string().email().required(),
  phone: Joi.string().min(10).max(15).required(),
  password: Joi.string().min(6).required()
});

const loginSchema = Joi.object({
  identifier: Joi.string(),
  email: Joi.string().email(),
  phone: Joi.string().min(10).max(15),
  password: Joi.string().required(),
}).or('identifier', 'email', 'phone');

const forgotPasswordSchema = Joi.object({
  email: Joi.string().email().required(),
});

const resetPasswordSchema = Joi.alternatives().try(
  Joi.object({
    token: Joi.string().required(),
    newPassword: Joi.string().min(6).required()
  }),
  Joi.object({
    email: Joi.string().email().required(),
    otp: Joi.string().length(6).required(),
    newPassword: Joi.string().min(6).required()
  })
);

const changePasswordSchema = Joi.object({
  currentPassword: Joi.string().required(),
  newPassword: Joi.string().min(6).required(),
});

const verifyTwoFactorSchema = Joi.object({
  twoFactorToken: Joi.string().required(),
  otp: Joi.string().length(6).required(),
});

// Generate JWT tokens
const generateTokens = (userId, role) => {
  const accessToken = jwt.sign(
    { userId, role },
    config.jwt.accessSecret,
    { expiresIn: config.jwt.accessExpires }
  );

  const refreshToken = jwt.sign(
    { userId },
    config.jwt.refreshSecret,
    { expiresIn: config.jwt.refreshExpires }
  );

  return { accessToken, refreshToken };
};

const authController = {
  register: async (req, res) => {
    try {
      const { error, value } = registerSchema.validate(req.body);
      if (error) {
        return validationErrorResponse(res, error);
      }

      const { firstName, lastName, email, phone, password } = value;

      // Check if user already exists
      const existingUser = await User.findOne({
        where: {
          [Sequelize.Op.or]: [{ email }, { phone }]
        }
      });

      if (existingUser) {
        return errorResponse(res, 'User with this email or phone already exists', 409);
      }

      const transaction = await require('../config/database').sequelize.transaction();

      try {
        // Create user - AUTO ACTIVATE for immediate dashboard access
        const user = await User.create({
          firstName,
          lastName,
          email,
          phone,
          passwordHash: password,
          status: 'active', // Changed from 'pending' to 'active'
          emailVerified: config.nodeEnv === 'development' // Auto-verify in development
        }, { transaction });

        // Generate verification token (for email verification later)
        const verificationToken = generateToken();
        const verificationTokenHash = await hashToken(verificationToken);
        const verificationTokenExpires = generateExpiryTime(24 * 60); // 24 hours

        // DEBUG: Log the actual token in development
        if (config.nodeEnv === 'development') {
          console.log('=== REGISTRATION DEBUG INFO ===');
          console.log('User Email:', email);
          console.log('Raw Verification Token:', verificationToken);
          console.log('Verification URL:', `${config.cors.origin}/verify-email?token=${verificationToken}`);
          console.log('================================');
        }

        await user.update({
          verificationTokenHash,
          verificationTokenExpires
        }, { transaction });

        // Send verification email (but don't block access)
        await EmailService.sendVerificationEmail(user, verificationToken);

        await transaction.commit();

        // Notify admins about new registration
        try {
          await NotificationService.notifyAdmins(
            'system',
            `New user registered: ${user.firstName} ${user.lastName}`,
            { userId: user.id, email: user.email }
          );
        } catch (e) {
          logger.error('Failed to notify admins about registration:', e);
        }

        // Generate tokens for immediate access
        const { accessToken, refreshToken } = generateTokens(user.id, user.role);

        // Store refresh token hash in database
        const refreshTokenHash = await hashToken(refreshToken);
        await user.update({ refreshTokenHash });

        // Set refresh token as HTTP-only cookie
        res.cookie('refreshToken', refreshToken, {
          httpOnly: true,
          secure: config.nodeEnv === 'production',
          sameSite: 'strict',
          maxAge: 7 * 24 * 60 * 60 * 1000
        });

        // Log audit
        await AuditLog.create({
          action: 'register',
          resourceType: 'user',
          resourceId: user.id,
          ip: req.ip,
          userAgent: req.get('User-Agent'),
          data: { email, phone }
        });

        return successResponse(res, {
          accessToken,
          user: {
            id: user.id,
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email,
            phone: user.phone,
            profileImage: getProfileImageUrl(user.profileImage),
            role: user.role,
            status: user.status,
            emailVerified: user.emailVerified
          }
        }, 'Registration successful. You can now access your dashboard.', 201);

      } catch (error) {
        await transaction.rollback();
        throw error;
      }
    } catch (error) {
      logger.error('Registration error:', error);
      return errorResponse(res, 'Registration failed', 500);
    }
  },

  login: async (req, res) => {
    try {
      const { error, value } = loginSchema.validate(req.body);
      if (error) {
        return validationErrorResponse(res, error);
      }

      const identifier = value.identifier || value.email || value.phone;
      const { password } = value;

      // Find user by email or phone
      const user = await User.findOne({
        where: {
          [Sequelize.Op.or]: [
            { email: identifier },
            { phone: identifier }
          ]
        }
      });

      if (!user) {
        return errorResponse(res, 'Invalid credentials', 401);
      }

      // Only block suspended and inactive users from logging in
      // Allow pending and active users to access dashboard
      if (user.status === 'suspended') {
        return errorResponse(res, 'Account suspended. Please contact support.', 403);
      }

      if (user.status === 'inactive') {
        return errorResponse(res, 'Account inactive. Please contact support.', 403);
      }

      // Check password
      let isPasswordValid = false;
      try {
        isPasswordValid = await user.comparePassword(password);
      } catch (e) {
        if (e?.message && e.message.toLowerCase().includes('locked')) {
          return errorResponse(res, e.message, 423);
        }
        throw e;
      }
      if (!isPasswordValid) {
        return errorResponse(res, 'Invalid credentials', 401);
      }

      if (user.twoFactorEnabled) {
        const otp = generateOTP(6);
        const otpHash = await hashToken(otp);
        const otpExpires = generateExpiryTime(10);
        await user.update({ twoFactorOtpHash: otpHash, twoFactorOtpExpires: otpExpires });

        await EmailService.sendTwoFactorOTP(user, otp);

        const twoFactorToken = jwt.sign(
          { userId: user.id, purpose: '2fa' },
          config.jwt.accessSecret,
          { expiresIn: '10m' }
        );

        return successResponse(
          res,
          { twoFactorRequired: true, twoFactorToken },
          'Two-factor verification required',
          202
        );
      }

      // Generate tokens
      const { accessToken, refreshToken } = generateTokens(user.id, user.role);

      // Store refresh token hash in database
      const refreshTokenHash = await hashToken(refreshToken);
      await user.update({ refreshTokenHash });

      // Set refresh token as HTTP-only cookie
      res.cookie('refreshToken', refreshToken, {
        httpOnly: true,
        secure: config.nodeEnv === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000
      });

      // Log audit
      await AuditLog.create({
        userId: user.id,
        action: 'login',
        resourceType: 'user',
        resourceId: user.id,
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });

      return successResponse(res, {
        accessToken,
        user: {
          id: user.id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          phone: user.phone,
          profileImage: getProfileImageUrl(user.profileImage),
          role: user.role,
          status: user.status,
          emailVerified: user.emailVerified,
          twoFactorEnabled: user.twoFactorEnabled
        }
      }, 'Login successful');
    } catch (error) {
      logger.error('Login error:', error);
      return errorResponse(res, 'Login failed', 500);
    }
  },

  refreshToken: async (req, res) => {
    try {
      const refreshToken = req.cookies.refreshToken || req.body.refreshToken;

      if (!refreshToken) {
        return errorResponse(res, 'Refresh token required', 401);
      }

      // Verify refresh token
      const decoded = jwt.verify(refreshToken, config.jwt.refreshSecret);
      const user = await User.findByPk(decoded.userId);

      if (!user || !user.refreshTokenHash) {
        return errorResponse(res, 'Invalid refresh token', 401);
      }

      if (user.status === 'suspended') {
        return errorResponse(res, 'Account suspended. Please contact support.', 403);
      }

      if (user.status === 'inactive') {
        return errorResponse(res, 'Account inactive. Please contact support.', 403);
      }

      // Verify stored hash
      const isValid = await verifyToken(refreshToken, user.refreshTokenHash);
      if (!isValid) {
        return errorResponse(res, 'Invalid refresh token', 401);
      }

      // Generate new tokens
      const { accessToken, refreshToken: newRefreshToken } = generateTokens(user.id, user.role);

      // Update refresh token hash
      const newRefreshTokenHash = await hashToken(newRefreshToken);
      await user.update({ refreshTokenHash: newRefreshTokenHash });

      // Set new refresh token cookie
      res.cookie('refreshToken', newRefreshToken, {
        httpOnly: true,
        secure: config.nodeEnv === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000
      });

      return successResponse(res, {
        accessToken,
        user: {
          id: user.id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          phone: user.phone,
          profileImage: getProfileImageUrl(user.profileImage),
          role: user.role,
          emailVerified: user.emailVerified,
          twoFactorEnabled: user.twoFactorEnabled
        }
      }, 'Token refreshed successfully');
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        return errorResponse(res, 'Refresh token expired', 401);
      }
      if (error.name === 'JsonWebTokenError') {
        return errorResponse(res, 'Invalid refresh token', 401);
      }
      logger.error('Token refresh error:', error);
      return errorResponse(res, 'Token refresh failed', 500);
    }
  },

  logout: async (req, res) => {
    try {
      const userId = req.user.id;

      // Clear refresh token from database
      await User.update({ refreshTokenHash: null }, { where: { id: userId } });

      // Clear refresh token cookie
      res.clearCookie('refreshToken');

      // Log audit
      await AuditLog.create({
        userId,
        action: 'logout',
        resourceType: 'user',
        resourceId: userId,
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });

      return successResponse(res, null, 'Logout successful');
    } catch (error) {
      logger.error('Logout error:', error);
      return errorResponse(res, 'Logout failed', 500);
    }
  },

  forgotPassword: async (req, res) => {
    try {
      const { error, value } = forgotPasswordSchema.validate(req.body);
      if (error) {
        return validationErrorResponse(res, error);
      }

      const { email } = value;

      const user = await User.findOne({ where: { email } });
      if (!user) {
        // Don't reveal that email doesn't exist
        return successResponse(res, null, 'If the email exists, an OTP has been sent');
      }

      if (user.status === 'suspended') {
        return errorResponse(res, 'Account is suspended', 403);
      }

      const otp = generateOTP(6);
      const resetTokenHash = await hashToken(otp);
      const resetTokenExpires = generateExpiryTime(10);

      if (config.nodeEnv === 'development') {
        console.log('=== PASSWORD RESET OTP DEBUG INFO ===');
        console.log('User Email:', email);
        console.log('OTP:', otp);
        console.log('=====================================');
      }
      await user.update({
        resetPasswordTokenHash: resetTokenHash,
        resetPasswordExpires: resetTokenExpires
      });

      const emailResult = await EmailService.sendPasswordResetOTP(user, otp);
      if (!emailResult?.success) {
        logger.error(
          `Failed to send password reset email to ${user.email}: ${emailResult?.error || 'unknown error'}`
        );
        return errorResponse(res, 'Failed to send password reset email. Please try again later.', 500);
      }

      // Log audit
      await AuditLog.create({
        userId: user.id,
        action: 'forgot_password',
        resourceType: 'user',
        resourceId: user.id,
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });

      return successResponse(res, null, 'If the email exists, an OTP has been sent');
    } catch (error) {
      logger.error('Forgot password error:', error);
      return errorResponse(res, 'Password reset request failed', 500);
    }
  },

  resetPassword: async (req, res) => {
    try {
      const { error, value } = resetPasswordSchema.validate(req.body);
      if (error) {
        return validationErrorResponse(res, error);
      }

      const { token, email, otp, newPassword } = value;

      let user = null;
      if (email && otp) {
        user = await User.findOne({ where: { email } });
        if (!user || !user.resetPasswordTokenHash || !user.resetPasswordExpires) {
          return errorResponse(res, 'Invalid or expired OTP', 400);
        }

        if (isTokenExpired(user.resetPasswordExpires)) {
          return errorResponse(res, 'Invalid or expired OTP', 400);
        }

        const isValidOtp = await verifyToken(otp, user.resetPasswordTokenHash);
        if (!isValidOtp) {
          return errorResponse(res, 'Invalid or expired OTP', 400);
        }
      } else {
        const users = await User.findAll({
          where: {
            resetPasswordTokenHash: { [Sequelize.Op.ne]: null }
          }
        });

        for (const u of users) {
          if (u.resetPasswordTokenHash) {
            const isValid = await verifyToken(token, u.resetPasswordTokenHash);
            const isExpired = isTokenExpired(u.resetPasswordExpires);

            if (isValid && !isExpired) {
              user = u;
              break;
            }
          }
        }

        if (!user) {
          return errorResponse(res, 'Invalid or expired reset token', 400);
        }
      }

      // Update password and clear reset token
      await user.update({
        passwordHash: newPassword,
        resetPasswordTokenHash: null,
        resetPasswordExpires: null,
        loginAttempts: 0,
        lockUntil: null
      });

      // Log audit
      await AuditLog.create({
        userId: user.id,
        action: 'password_reset',
        resourceType: 'user',
        resourceId: user.id,
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });

      return successResponse(res, null, 'Password reset successfully. You can now login with your new password.');
    } catch (error) {
      logger.error('Reset password error:', error);
      return errorResponse(res, 'Password reset failed', 500);
    }
  },

  getMe: async (req, res) => {
    try {
      const user = req.user;
      return successResponse(res, {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        phone: user.phone,
        address: user.address,
        city: user.city,
        dob: user.dob,
        profileImage: getProfileImageUrl(user.profileImage),
        role: user.role,
        status: user.status,
        emailVerified: user.emailVerified,
        twoFactorEnabled: user.twoFactorEnabled,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
      });
    } catch (error) {
      logger.error('Get me error:', error);
      return errorResponse(res, 'Failed to get user data', 500);
    }
  },

  verifyEmail: async (req, res) => {
    try {
      const token = req.query.token;
      if (!token) return errorResponse(res, 'Token is required', 400);

      const users = await User.findAll({
        where: {
          verificationTokenHash: { [Sequelize.Op.ne]: null }
        }
      });

      let user = null;
      for (const u of users) {
        if (!u.verificationTokenHash) continue;
        const isValid = await verifyToken(token, u.verificationTokenHash);
        const isExpired = isTokenExpired(u.verificationTokenExpires);
        if (isValid && !isExpired) {
          user = u;
          break;
        }
      }

      if (!user) return errorResponse(res, 'Invalid or expired token', 400);

      await user.update({
        emailVerified: true,
        verificationTokenHash: null,
        verificationTokenExpires: null,
      });

      await AuditLog.create({
        userId: user.id,
        action: 'verify_email',
        resourceType: 'user',
        resourceId: user.id,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
      });

      return successResponse(res, { emailVerified: true }, 'Email verified successfully');
    } catch (error) {
      logger.error('Verify email error:', error);
      return errorResponse(res, 'Email verification failed', 500);
    }
  },

  resendVerificationEmail: async (req, res) => {
    try {
      const user = await User.findByPk(req.user.id);
      if (!user) return errorResponse(res, 'User not found', 404);

      if (user.emailVerified) {
        return successResponse(res, { emailVerified: true }, 'Email already verified');
      }

      const verificationToken = generateToken();
      const verificationTokenHash = await hashToken(verificationToken);
      const verificationTokenExpires = generateExpiryTime(24 * 60);

      await user.update({ verificationTokenHash, verificationTokenExpires });
      await EmailService.sendVerificationEmail(user, verificationToken);

      await AuditLog.create({
        userId: user.id,
        action: 'resend_verification_email',
        resourceType: 'user',
        resourceId: user.id,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
      });

      return successResponse(res, null, 'Verification email sent');
    } catch (error) {
      logger.error('Resend verification email error:', error);
      return errorResponse(res, 'Failed to resend verification email', 500);
    }
  },

  changePassword: async (req, res) => {
    try {
      const { error, value } = changePasswordSchema.validate(req.body);
      if (error) return validationErrorResponse(res, error);

      const user = await User.findByPk(req.user.id);
      if (!user) return errorResponse(res, 'User not found', 404);

      const ok = await user.comparePassword(value.currentPassword);
      if (!ok) return errorResponse(res, 'Current password is incorrect', 401);

      await user.update({
        passwordHash: value.newPassword,
        resetPasswordTokenHash: null,
        resetPasswordExpires: null,
        loginAttempts: 0,
        lockUntil: null,
      });

      await AuditLog.create({
        userId: user.id,
        action: 'change_password',
        resourceType: 'user',
        resourceId: user.id,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
      });

      return successResponse(res, null, 'Password changed successfully');
    } catch (error) {
      logger.error('Change password error:', error);
      return errorResponse(res, 'Failed to change password', 500);
    }
  },

  enableTwoFactor: async (req, res) => {
    try {
      const user = await User.findByPk(req.user.id);
      if (!user) return errorResponse(res, 'User not found', 404);
      if (!user.emailVerified) return errorResponse(res, 'Email must be verified before enabling 2FA', 400);

      await user.update({ twoFactorEnabled: true });

      await AuditLog.create({
        userId: user.id,
        action: 'enable_2fa',
        resourceType: 'user',
        resourceId: user.id,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
      });

      return successResponse(res, { twoFactorEnabled: true }, 'Two-factor authentication enabled');
    } catch (error) {
      logger.error('Enable 2FA error:', error);
      return errorResponse(res, 'Failed to enable 2FA', 500);
    }
  },

  disableTwoFactor: async (req, res) => {
    try {
      const user = await User.findByPk(req.user.id);
      if (!user) return errorResponse(res, 'User not found', 404);

      await user.update({ twoFactorEnabled: false, twoFactorOtpHash: null, twoFactorOtpExpires: null });

      await AuditLog.create({
        userId: user.id,
        action: 'disable_2fa',
        resourceType: 'user',
        resourceId: user.id,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
      });

      return successResponse(res, { twoFactorEnabled: false }, 'Two-factor authentication disabled');
    } catch (error) {
      logger.error('Disable 2FA error:', error);
      return errorResponse(res, 'Failed to disable 2FA', 500);
    }
  },

  verifyTwoFactor: async (req, res) => {
    try {
      const { error, value } = verifyTwoFactorSchema.validate(req.body);
      if (error) return validationErrorResponse(res, error);

      let decoded = null;
      try {
        decoded = jwt.verify(value.twoFactorToken, config.jwt.accessSecret);
      } catch {
        decoded = null;
      }
      if (!decoded?.userId || decoded?.purpose !== '2fa') {
        return errorResponse(res, 'Invalid two-factor token', 401);
      }

      const user = await User.findByPk(decoded.userId);
      if (!user) return errorResponse(res, 'User not found', 404);

      if (!user.twoFactorOtpHash || !user.twoFactorOtpExpires || isTokenExpired(user.twoFactorOtpExpires)) {
        return errorResponse(res, 'OTP expired. Please login again.', 400);
      }

      const ok = await verifyToken(value.otp, user.twoFactorOtpHash);
      if (!ok) return errorResponse(res, 'Invalid OTP', 401);

      await user.update({ twoFactorOtpHash: null, twoFactorOtpExpires: null });

      const { accessToken, refreshToken } = generateTokens(user.id, user.role);
      const refreshTokenHash = await hashToken(refreshToken);
      await user.update({ refreshTokenHash });

      res.cookie('refreshToken', refreshToken, {
        httpOnly: true,
        secure: config.nodeEnv === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000
      });

      await AuditLog.create({
        userId: user.id,
        action: '2fa_verified',
        resourceType: 'user',
        resourceId: user.id,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
      });

      return successResponse(res, {
        accessToken,
        user: {
          id: user.id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          phone: user.phone,
          profileImage: user.profileImage,
          role: user.role,
          status: user.status,
          emailVerified: user.emailVerified,
          twoFactorEnabled: user.twoFactorEnabled,
        }
      }, 'Login successful');
    } catch (error) {
      logger.error('Verify 2FA error:', error);
      return errorResponse(res, 'Failed to verify 2FA', 500);
    }
  }
};


module.exports = authController;