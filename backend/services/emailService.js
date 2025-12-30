const sendEmail = require('../config/sendEmail');
const {
  getVerificationEmailTemplate,
  getPasswordResetTemplate,
  getBookingConfirmationTemplate,
  getPaymentReceiptTemplate,
} = require('../utils/emailTemplate');
const config = require('../config/env');
const logger = require('../utils/logger');

class EmailService {
  static async sendVerificationEmail(user, token) {
    try {
      const verificationUrl = `${config.cors.origin}/verify-email?token=${token}`;
      const html = getVerificationEmailTemplate(`${user.firstName} ${user.lastName}`, verificationUrl);
      
      const result = await sendEmail(
        user.email,
        'Verify Your Email Address - Event Booking Platform',
        html
      );

      if (result.success) {
        logger.info(`Verification email processed for ${user.email}`);
      } else {
        logger.error(`Failed to process verification email for ${user.email}: ${result.error}`);
      }

      return result;
    } catch (error) {
      logger.error('Error in sendVerificationEmail:', error);
      return { success: false, error: error.message };
    }
  }

  static async sendPasswordResetEmail(user, token) {
    try {
      const resetUrl = `${config.cors.origin}/reset-password?token=${token}`;
      const html = getPasswordResetTemplate(`${user.firstName} ${user.lastName}`, resetUrl);
      
      const result = await sendEmail(
        user.email,
        'Reset Your Password - Event Booking Platform',
        html
      );

      if (result.success) {
        logger.info(`Password reset email processed for ${user.email}`);
      } else {
        logger.error(`Failed to process password reset email for ${user.email}: ${result.error}`);
      }

      return result;
    } catch (error) {
      logger.error('Error in sendPasswordResetEmail:', error);
      return { success: false, error: error.message };
    }
  }

  static async sendPasswordResetOTP(user, otp) {
    try {
      const html = `
        <!DOCTYPE html>
        <html>
        <head><meta charset="utf-8"></head>
        <body>
          <h2>Password reset code</h2>
          <p>Use this OTP to reset your password:</p>
          <p style="font-size: 24px; font-weight: bold; letter-spacing: 4px;">${otp}</p>
          <p>This code will expire in 10 minutes.</p>
        </body>
        </html>
      `;

      const result = await sendEmail(
        user.email,
        'Your password reset code - Event Booking Platform',
        html
      );

      if (result.success) {
        logger.info(`Password reset OTP email processed for ${user.email}`);
      } else {
        logger.error(`Failed to process password reset OTP email for ${user.email}: ${result.error}`);
      }

      return result;
    } catch (error) {
      logger.error('Error in sendPasswordResetOTP:', error);
      return { success: false, error: error.message };
    }
  }

  static async sendBookingConfirmation(booking, user) {
    try {
      const html = getBookingConfirmationTemplate(booking);
      const email = user?.email || booking.customerEmail;
      
      const result = await sendEmail(
        email,
        'Booking Confirmation - Event Booking Platform',
        html
      );

      if (result.success) {
        logger.info(`Booking confirmation processed for ${email}`);
      } else {
        logger.error(`Failed to process booking confirmation for ${email}: ${result.error}`);
      }

      return result;
    } catch (error) {
      logger.error('Error in sendBookingConfirmation:', error);
      return { success: false, error: error.message };
    }
  }

  static async sendPaymentReceipt(payment, booking, user) {
    try {
      const html = getPaymentReceiptTemplate(payment, booking);
      const email = user?.email || booking.customerEmail;
      
      const result = await sendEmail(
        email,
        'Payment Receipt - Event Booking Platform',
        html
      );

      if (result.success) {
        logger.info(`Payment receipt processed for ${email}`);
      } else {
        logger.error(`Failed to process payment receipt for ${email}: ${result.error}`);
      }

      return result;
    } catch (error) {
      logger.error('Error in sendPaymentReceipt:', error);
      return { success: false, error: error.message };
    }
  }

  static async sendTwoFactorOTP(user, otp) {
    try {
      const html = `
        <!DOCTYPE html>
        <html>
        <head><meta charset="utf-8"></head>
        <body>
          <h2>Your verification code</h2>
          <p>Use this OTP to complete your login:</p>
          <p style="font-size: 24px; font-weight: bold; letter-spacing: 4px;">${otp}</p>
          <p>This code will expire in 10 minutes.</p>
        </body>
        </html>
      `;

      const result = await sendEmail(
        user.email,
        'Your login verification code - Event Booking Platform',
        html
      );

      if (result.success) {
        logger.info(`2FA OTP email processed for ${user.email}`);
      } else {
        logger.error(`Failed to process 2FA OTP email for ${user.email}: ${result.error}`);
      }

      return result;
    } catch (error) {
      logger.error('Error in sendTwoFactorOTP:', error);
      return { success: false, error: error.message };
    }
  }

  static async sendAdminNotification(subject, message) {
    try {
      // In development, use a test email
      const adminEmails = config.nodeEnv === 'production' 
        ? ['admin@example.com'] 
        : ['test@example.com'];
      
      const html = `
        <!DOCTYPE html>
        <html>
        <head><meta charset="utf-8"></head>
        <body>
          <h2>${subject}</h2>
          <p>${message}</p>
        </body>
        </html>
      `;

      const results = await Promise.all(
        adminEmails.map(email => 
          sendEmail(email, `Admin Notification: ${subject}`, html)
        )
      );

      const failed = results.filter(result => !result.success);
      if (failed.length > 0) {
        logger.error(`Failed to send admin notifications to ${failed.length} emails`);
      }

      return {
        success: failed.length === 0,
        results,
      };
    } catch (error) {
      logger.error('Error in sendAdminNotification:', error);
      return { success: false, error: error.message };
    }
  }
}

module.exports = EmailService;