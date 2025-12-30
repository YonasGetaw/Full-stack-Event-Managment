const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Gallery = sequelize.define('Gallery', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  title: {
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
  category: {
    type: DataTypes.ENUM(
      'wedding',
      'birthday',
      'corporate',
      'decoration',
      'catering',
      'other'
    ),
    allowNull: false,
  },
  location: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  date: {
    type: DataTypes.DATEONLY,
    allowNull: true,
  },
  imageFilename: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  imageUrl: {
    type: DataTypes.STRING,
    allowNull: false,
  },
}, {
  tableName: 'gallery',
  timestamps: true,
});

module.exports = Gallery;