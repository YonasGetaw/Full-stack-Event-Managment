const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const PricingRule = sequelize.define('PricingRule', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  eventType: {
    type: DataTypes.ENUM('wedding', 'birthday', 'corporate', 'other'),
    allowNull: false,
    unique: true,
  },
  basePrice: {
    type: DataTypes.INTEGER,
    allowNull: false,
    validate: { min: 0 },
  },
  perGuest: {
    type: DataTypes.INTEGER,
    allowNull: false,
    validate: { min: 0 },
  },
  perHour: {
    type: DataTypes.INTEGER,
    allowNull: false,
    validate: { min: 0 },
  },
  defaultHours: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 5,
    validate: { min: 1 },
  },
}, {
  tableName: 'pricing_rules',
  timestamps: true,
});

module.exports = PricingRule;
