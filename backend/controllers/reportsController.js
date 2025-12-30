const { successResponse, errorResponse } = require('../utils/response');
const { Event, Payment } = require('../models');
const logger = require('../utils/logger');

const reportsController = {
  getEventStats: async (req, res) => {
    try {
      // Count of tickets per event
      const ticketCounts = await Payment.findAll({
        attributes: [
          [require('sequelize').fn('COUNT', require('sequelize').col('Payment.id')), 'ticketCount'],
          [require('sequelize').fn('SUM', require('sequelize').col('Payment.amount')), 'totalRevenue'],
        ],
        where: { eventId: { [require('sequelize').Op.ne]: null }, status: 'completed' },
        include: [
          {
            model: Event,
            as: 'event',
            attributes: ['id', 'title', 'eventType', 'eventDate', 'eventTime'],
          },
        ],
        group: ['event.id'],
        order: [[require('sequelize').literal('"ticketCount"'), 'DESC']],
        raw: false,
      });

      // Count by event type
      const eventTypeCounts = await Event.findAll({
        attributes: [
          'eventType',
          [require('sequelize').fn('COUNT', require('sequelize').col('Event.id')), 'eventCount'],
        ],
        where: { status: 'published' },
        group: ['eventType'],
        order: [[require('sequelize').literal('"eventCount"'), 'DESC']],
        raw: false,
      });

      // Overall totals
      const totalTickets = await Payment.count({
        where: { eventId: { [require('sequelize').Op.ne]: null }, status: 'completed' },
      });

      const totalRevenue = await Payment.sum('amount', {
        where: { eventId: { [require('sequelize').Op.ne]: null }, status: 'completed' },
      }) || 0;

      return successResponse(res, {
        totalTickets,
        totalRevenue,
        ticketCounts: ticketCounts.map(row => ({
          eventId: row.event.id,
          eventTitle: row.event.title,
          eventType: row.event.eventType,
          eventDate: row.event.eventDate,
          eventTime: row.event.eventTime,
          ticketCount: parseInt(row.dataValues.ticketCount, 10),
          totalRevenue: parseInt(row.dataValues.totalRevenue, 10),
        })),
        eventTypeCounts: eventTypeCounts.map(row => ({
          eventType: row.eventType,
          eventCount: parseInt(row.dataValues.eventCount, 10),
        })),
      });
    } catch (error) {
      logger.error('Get event stats error:', error);
      return errorResponse(res, 'Failed to get event stats', 500);
    }
  },
};

module.exports = reportsController;
