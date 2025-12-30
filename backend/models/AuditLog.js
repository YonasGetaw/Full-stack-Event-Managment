const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const AuditLog = sequelize.define('AuditLog', {
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
  action: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  resourceType: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  resourceId: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  ip: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  userAgent: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  data: {
    type: DataTypes.JSONB,
    allowNull: true,
  },
}, {
  tableName: 'audit_logs',
  timestamps: true,
});

module.exports = AuditLog;