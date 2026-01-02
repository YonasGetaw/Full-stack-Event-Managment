const { successResponse, errorResponse } = require('../utils/response');
const { Event, Payment, User, Booking } = require('../models');
const logger = require('../utils/logger');

const { Op, fn, col, literal } = require('sequelize');

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

  // Admin dashboard metrics
  getAdminDashboardMetrics: async (req, res) => {
    try {
      const totalUsers = await User.count();
      const totalBookings = await Booking.count();
      const totalRevenue = await Payment.sum('amount') || 0;
      const totalGallery = await Event.count({ where: { status: 'published' } });
      
      const activeUsers = await User.count({ where: { status: 'active' } });
      const pendingBookings = await Booking.count({ where: { status: 'pending' } });
      
      // Get recent activity
      const recentActivity = await Payment.findAll({
        include: [{
          model: User,
          as: 'user',
          attributes: ['firstName', 'lastName', 'email'],
          required: false
        }],
        order: [['createdAt', 'DESC']],
        limit: 10
      });

      return successResponse(res, {
        totals: {
          users: totalUsers,
          bookings: totalBookings,
          revenue: totalRevenue,
          gallery: totalGallery,
          activeUsers,
          pendingBookings
        },
        recentActivity: recentActivity.map(p => ({
          id: p.id,
          user: p.user,
          createdAt: p.createdAt,
          type: 'payment',
          amount: p.amount
        }))
      });
    } catch (error) {
      logger.error('Get admin dashboard metrics error:', error);
      return errorResponse(res, 'Failed to get dashboard metrics', 500);
    }
  },

  getAdminBookingsOverTime: async (req, res) => {
    try {
      const { groupBy = 'day' } = req.query;
      
      let dateFormat;
      switch (groupBy) {
        case 'day':
          dateFormat = 'YYYY-MM-DD';
          break;
        case 'week':
          dateFormat = 'YYYY-"WW"';
          break;
        case 'month':
          dateFormat = 'YYYY-MM';
          break;
        case 'year':
          dateFormat = 'YYYY';
          break;
        default:
          dateFormat = 'YYYY-MM-DD';
      }

      const bookings = await Booking.findAll({
        attributes: [
          [require('sequelize').fn('DATE_TRUNC', require('sequelize').literal(`'${groupBy}'`)), 'period'],
          [require('sequelize').fn('COUNT', require('sequelize').col('Booking.id')), 'count'],
        ],
        group: [require('sequelize').fn('DATE_TRUNC', require('sequelize').literal(`'${groupBy}'`))],
        order: [[require('sequelize').fn('DATE_TRUNC', require('sequelize').literal(`'${groupBy}'`)), 'ASC']],
      });

      return successResponse(res, bookings);
    } catch (error) {
      logger.error('Get bookings over time error:', error);
      return errorResponse(res, 'Failed to get bookings over time', 500);
    }
  },

  getAdminRevenueOverTime: async (req, res) => {
    try {
      const { groupBy = 'day' } = req.query;
      
      let dateFormat;
      switch (groupBy) {
        case 'day':
          dateFormat = 'YYYY-MM-DD';
          break;
        case 'week':
          dateFormat = 'YYYY-"WW"';
          break;
        case 'month':
          dateFormat = 'YYYY-MM';
          break;
        case 'year':
          dateFormat = 'YYYY';
          break;
        default:
          dateFormat = 'YYYY-MM-DD';
      }

      const revenue = await Payment.findAll({
        attributes: [
          [require('sequelize').fn('DATE_TRUNC', require('sequelize').literal(`'${groupBy}'`)), 'period'],
          [require('sequelize').fn('SUM', require('sequelize').col('amount')), 'revenue'],
          [require('sequelize').fn('COUNT', require('sequelize').col('Payment.id')), 'transactions'],
        ],
        where: { status: 'completed' },
        group: [require('sequelize').fn('DATE_TRUNC', require('sequelize').literal(`'${groupBy}'`))],
        order: [[require('sequelize').fn('DATE_TRUNC', require('sequelize').literal(`'${groupBy}'`)), 'ASC']],
      });

      return successResponse(res, revenue);
    } catch (error) {
      logger.error('Get revenue over time error:', error);
      return errorResponse(res, 'Failed to get revenue over time', 500);
    }
  },

  getAdminServiceDistribution: async (req, res) => {
    try {
      const distribution = await Event.findAll({
        attributes: [
          'eventType',
          [require('sequelize').fn('COUNT', require('sequelize').col('Event.id')), 'bookings'],
        ],
        where: { status: 'published' },
        group: ['eventType'],
      });

      return successResponse(res, distribution);
    } catch (error) {
      logger.error('Get service distribution error:', error);
      return errorResponse(res, 'Failed to get service distribution', 500);
    }
  },

  getAdminUserGrowthOverTime: async (req, res) => {
    try {
      const { groupBy = 'day' } = req.query;
      
      let dateFormat;
      switch (groupBy) {
        case 'day':
          dateFormat = 'YYYY-MM-DD';
          break;
        case 'week':
          dateFormat = 'YYYY-"WW"';
          break;
        case 'month':
          dateFormat = 'YYYY-MM';
          break;
        case 'year':
          dateFormat = 'YYYY';
          break;
        default:
          dateFormat = 'YYYY-MM-DD';
      }

      const userGrowth = await User.findAll({
        attributes: [
          [require('sequelize').fn('DATE_TRUNC', require('sequelize').literal(`'${groupBy}'`)), 'period'],
          [require('sequelize').fn('COUNT', require('sequelize').col('User.id')), 'count'],
        ],
        group: [require('sequelize').fn('DATE_TRUNC', require('sequelize').literal(`'${groupBy}'`))],
        order: [[require('sequelize').fn('DATE_TRUNC', require('sequelize').literal(`'${groupBy}'`)), 'ASC']],
      });

      return successResponse(res, userGrowth);
    } catch (error) {
      logger.error('Get user growth over time error:', error);
      return errorResponse(res, 'Failed to get user growth over time', 500);
    }
  },

  getAdminTrafficSource: async (req, res) => {
    try {
      // Placeholder for traffic source analytics
      return successResponse(res, []);
    } catch (error) {
      logger.error('Get traffic source error:', error);
      return errorResponse(res, 'Failed to get traffic source', 500);
    }
  },
};

module.exports = reportsController;
