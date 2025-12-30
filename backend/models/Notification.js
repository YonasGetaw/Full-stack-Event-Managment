const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Notification = sequelize.define('Notification', {
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
  type: {
    type: DataTypes.ENUM(
      'booking_created',
      'payment_created',
      'payment_completed',
      'payment_failed',
      'booking_confirmed',
      'booking_cancelled',
      'system',
      'promotional'
    ),
    allowNull: false,
  },
  title: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  message: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  read: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  metadata: {
    type: DataTypes.JSONB,
    allowNull: true,
  },
}, {
  tableName: 'notifications',
  timestamps: true,
});

module.exports = Notification;