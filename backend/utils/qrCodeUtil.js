const QRCode = require('qrcode');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

const generateQRCode = async (data, options = {}) => {
  try {
    const {
      format = 'png',
      quality = 0.8,
      width = 300,
      margin = 1,
      saveToFile = false,
      fileName = null
    } = options;

    const qrOptions = {
      quality,
      width,
      margin,
      type: format === 'png' ? 'image/png' : 'image/jpeg',
    };

    if (saveToFile) {
      const filename = fileName || `${uuidv4()}.${format}`;
      const filePath = path.join(__dirname, '../uploads/qrcodes', filename);
      
      // Ensure directory exists
      const dir = path.dirname(filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      await QRCode.toFile(filePath, data, qrOptions);
      
      return {
        success: true,
        filePath,
        fileName: filename,
        url: `/uploads/qrcodes/${filename}`,
      };
    } else {
      const dataUrl = await QRCode.toDataURL(data, qrOptions);
      return {
        success: true,
        dataUrl,
      };
    }
  } catch (error) {
    console.error('QR Code generation error:', error);
    return {
      success: false,
      error: error.message,
    };
  }
};

const generatePaymentQRData = (paymentData) => {
  const {
    amount,
    paymentMethod,
    phoneNumber,
    transactionId,
    date,
  } = paymentData;

  return `Payment Details:
Amount: ${amount} ETB
Payment Method: ${paymentMethod}
Phone Number: ${phoneNumber}
Transaction ID: ${transactionId}
Date: ${date}`;
};

module.exports = {
  generateQRCode,
  generatePaymentQRData,
};