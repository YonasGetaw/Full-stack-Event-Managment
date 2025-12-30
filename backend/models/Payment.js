const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Payment = sequelize.define('Payment', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  bookingId: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'bookings',
      key: 'id',
    },
  },
  eventId: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'events',
      key: 'id',
    },
  },
  userId: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'users',
      key: 'id',
    },
  },
  amount: {
    type: DataTypes.INTEGER,
    allowNull: false,
    validate: {
      min: 0,
    },
  },
  currency: {
    type: DataTypes.STRING,
    defaultValue: 'ETB',
  },
  paymentMethod: {
    type: DataTypes.ENUM('telebirr', 'cbe', 'commercial', 'abisiniya', 'abyssinia'),
    allowNull: false,
  },
  phoneNumber: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  transactionId: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  status: {
    type: DataTypes.ENUM('pending', 'processing', 'completed', 'failed', 'refunded'),
    defaultValue: 'pending',
  },
  metadata: {
    type: DataTypes.JSONB,
    allowNull: true,
  },
  proofImageUrl: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  proofUploadedAt: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  qrCodeUrl: {
    type: DataTypes.STRING,
    allowNull: true,
  },
}, {
  tableName: 'payments',
  timestamps: true,
});

module.exports = Payment;