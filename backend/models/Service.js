const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Service = sequelize.define('Service', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      notEmpty: true,
    },
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  price: {
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
  category: {
    type: DataTypes.ENUM(
      'catering',
      'decoration',
      'entertainment',
      'photography',
      'venue',
      'other'
    ),
    allowNull: false,
  },
  status: {
    type: DataTypes.ENUM('active', 'inactive'),
    defaultValue: 'active',
  },
  featured: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  images: {
    type: DataTypes.ARRAY(DataTypes.STRING),
    defaultValue: [],
  },
}, {
  tableName: 'services',
  timestamps: true,
});

module.exports = Service;