const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Event = sequelize.define(
  'Event',
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    title: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: { notEmpty: true },
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    eventType: {
      type: DataTypes.ENUM('wedding', 'birthday', 'corporate', 'decoration', 'catering', 'other'),
      allowNull: false,
      defaultValue: 'other',
    },
    location: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    latitude: {
      type: DataTypes.FLOAT,
      allowNull: true,
    },
    longitude: {
      type: DataTypes.FLOAT,
      allowNull: true,
    },
    eventDate: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    eventTime: {
      type: DataTypes.TIME,
      allowNull: false,
    },
    ticketPrice: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: { min: 0 },
    },
    totalTickets: {
      type: DataTypes.INTEGER,
      allowNull: true,
      validate: { min: 0 },
    },
    status: {
      type: DataTypes.ENUM('draft', 'published', 'cancelled'),
      allowNull: false,
      defaultValue: 'published',
    },
    imageFilename: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    imageUrl: {
      type: DataTypes.STRING,
      allowNull: true,
    },
  },
  {
    tableName: 'events',
    timestamps: true,
  }
);

// Virtual field: remaining tickets
Event.prototype.getRemainingTickets = async function() {
  const Payment = require('./Payment');
  if (this.totalTickets == null) return null;
  const soldCount = await Payment.count({
    where: {
      eventId: this.id,
      status: 'completed',
    },
  });
  return Math.max(0, this.totalTickets - soldCount);
};

// Helper to include remainingTickets in responses
Event.addRemainingTickets = async (events) => {
  const Payment = require('./Payment');
  const eventIds = events.map(e => e.id);
  const soldCounts = await Payment.findAll({
    attributes: [
      'eventId',
      [require('sequelize').fn('COUNT', require('sequelize').col('id')), 'soldCount'],
    ],
    where: {
      eventId: eventIds,
      status: 'completed',
    },
    group: ['eventId'],
    raw: true,
  });
  const soldMap = {};
  soldCounts.forEach(row => {
    soldMap[row.eventId] = parseInt(row.soldCount, 10);
  });
  return events.map(e => ({
    ...e.toJSON(),
    remainingTickets: e.totalTickets == null ? null : Math.max(0, e.totalTickets - (soldMap[e.id] || 0)),
  }));
};

module.exports = Event;
