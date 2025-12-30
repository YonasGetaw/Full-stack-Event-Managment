const getVerificationEmailTemplate = (name, verificationUrl) => {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #4F46E5; color: white; padding: 20px; text-align: center; }
        .content { background: #f9f9f9; padding: 30px; }
        .button { background: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block; }
        .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Email Verification</h1>
        </div>
        <div class="content">
          <h2>Hello ${name},</h2>
          <p>Thank you for registering with our Event Booking Platform. Please verify your email address by clicking the button below:</p>
          <p style="text-align: center;">
            <a href="${verificationUrl}" class="button">Verify Email Address</a>
          </p>
          <p>If the button doesn't work, copy and paste this link into your browser:</p>
          <p>${verificationUrl}</p>
          <p>This link will expire in 24 hours.</p>
        </div>
        <div class="footer">
          <p>If you didn't create this account, please ignore this email.</p>
          <p>© 2024 Event Booking Platform. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;
};

const getPasswordResetTemplate = (name, resetUrl) => {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #DC2626; color: white; padding: 20px; text-align: center; }
        .content { background: #f9f9f9; padding: 30px; }
        .button { background: #DC2626; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block; }
        .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Password Reset</h1>
        </div>
        <div class="content">
          <h2>Hello ${name},</h2>
          <p>We received a request to reset your password. Click the button below to create a new password:</p>
          <p style="text-align: center;">
            <a href="${resetUrl}" class="button">Reset Password</a>
          </p>
          <p>If the button doesn't work, copy and paste this link into your browser:</p>
          <p>${resetUrl}</p>
          <p>This link will expire in 1 hour.</p>
          <p>If you didn't request a password reset, please ignore this email.</p>
        </div>
        <div class="footer">
          <p>© 2024 Event Booking Platform. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;
};

const getBookingConfirmationTemplate = (booking) => {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #059669; color: white; padding: 20px; text-align: center; }
        .content { background: #f9f9f9; padding: 30px; }
        .booking-details { background: white; padding: 20px; border-radius: 4px; border: 1px solid #ddd; }
        .detail-row { display: flex; justify-content: space-between; margin-bottom: 10px; }
        .detail-label { font-weight: bold; color: #666; }
        .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Booking Confirmation</h1>
        </div>
        <div class="content">
          <h2>Thank you for your booking!</h2>
          <p>Your event has been successfully booked. Here are your booking details:</p>
          
          <div class="booking-details">
            <div class="detail-row">
              <span class="detail-label">Booking ID:</span>
              <span>${booking.id}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Event Type:</span>
              <span>${booking.eventType}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Event Date:</span>
              <span>${booking.eventDate}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Event Time:</span>
              <span>${booking.eventTime}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Guest Count:</span>
              <span>${booking.guestCount}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Total Amount:</span>
              <span>${booking.priceCalculated} ETB</span>
            </div>
          </div>
          
          <p>We will contact you shortly to discuss further details. If you have any questions, please don't hesitate to contact us.</p>
        </div>
        <div class="footer">
          <p>© 2024 Event Booking Platform. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;
};

const getPaymentReceiptTemplate = (payment, booking) => {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #2563EB; color: white; padding: 20px; text-align: center; }
        .content { background: #f9f9f9; padding: 30px; }
        .receipt-details { background: white; padding: 20px; border-radius: 4px; border: 1px solid #ddd; }
        .detail-row { display: flex; justify-content: space-between; margin-bottom: 10px; }
        .detail-label { font-weight: bold; color: #666; }
        .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Payment Receipt</h1>
        </div>
        <div class="content">
          <h2>Payment Successful!</h2>
          <p>Thank you for your payment. Here is your receipt:</p>
          
          <div class="receipt-details">
            <div class="detail-row">
              <span class="detail-label">Transaction ID:</span>
              <span>${payment.transactionId}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Amount Paid:</span>
              <span>${payment.amount} ETB</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Payment Method:</span>
              <span>${payment.paymentMethod}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Payment Date:</span>
              <span>${new Date(payment.createdAt).toLocaleDateString()}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Booking Reference:</span>
              <span>${booking.id}</span>
            </div>
          </div>
          
          <p>Your booking is now confirmed. You can download your QR code from your dashboard.</p>
        </div>
        <div class="footer">
          <p>© 2024 Event Booking Platform. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;
};

module.exports = {
  getVerificationEmailTemplate,
  getPasswordResetTemplate,
  getBookingConfirmationTemplate,
  getPaymentReceiptTemplate,
};