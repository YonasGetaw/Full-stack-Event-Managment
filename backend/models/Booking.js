const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Booking = sequelize.define('Booking', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  userId: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'users',
      key: 'id',
    },
  },
  customerName: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      notEmpty: true,
    },
  },
  customerEmail: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      isEmail: true,
    },
  },
  customerPhone: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  serviceId: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'services',
      key: 'id',
    },
  },
  serviceSnapshot: {
    type: DataTypes.JSONB,
    allowNull: true,
  },
  eventType: {
    type: DataTypes.ENUM('wedding', 'birthday', 'corporate', 'other'),
    defaultValue: 'wedding',
  },
  eventDate: {
    type: DataTypes.DATEONLY,
    allowNull: false,
  },
  eventTime: {
    type: DataTypes.TIME,
    allowNull: false,
  },
  guestCount: {
    type: DataTypes.INTEGER,
    allowNull: false,
    validate: {
      min: 1,
    },
  },
  durationHours: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 5,
    validate: {
      min: 1,
    },
  },
  message: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  priceCalculated: {
    type: DataTypes.INTEGER,
    allowNull: false,
    validate: {
      min: 0,
    },
  },
  status: {
    type: DataTypes.ENUM('pending', 'confirmed', 'cancelled', 'completed'),
    defaultValue: 'pending',
  },
  paymentStatus: {
    type: DataTypes.ENUM('unpaid', 'processing', 'paid', 'failed', 'refunded'),
    defaultValue: 'unpaid',
  },
  qrCodeUrl: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  transactionId: {
    type: DataTypes.STRING,
    allowNull: true,
  },
}, {
  tableName: 'bookings',
  timestamps: true,
});

module.exports = Booking;