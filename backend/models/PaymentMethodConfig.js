const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const PaymentMethodConfig = sequelize.define('PaymentMethodConfig', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  method: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
  },
  receiverName: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  receiverPhone: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  receiverAccountNumber: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  note: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },
}, {
  tableName: 'payment_method_configs',
  timestamps: true,
});

module.exports = PaymentMethodConfig;
