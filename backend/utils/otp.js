const crypto = require('crypto');
const bcrypt = require('bcrypt');

const generateOTP = (length = 6) => {
  const digits = '0123456789';
  let OTP = '';
  for (let i = 0; i < length; i++) {
    OTP += digits[Math.floor(Math.random() * 10)];
  }
  return OTP;
};

const generateToken = (length = 32) => {
  return crypto.randomBytes(length).toString('hex');
};

const hashToken = async (token) => {
  return await bcrypt.hash(token, 10);
};

const verifyToken = async (token, hashedToken) => {
  return await bcrypt.compare(token, hashedToken);
};

const generateExpiryTime = (minutes = 15) => {
  return new Date(Date.now() + minutes * 60 * 1000);
};

const isTokenExpired = (expiryTime) => {
  return new Date() > new Date(expiryTime);
};

module.exports = {
  generateOTP,
  generateToken,
  hashToken,
  verifyToken,
  generateExpiryTime,
  isTokenExpired,
};