const { Booking, Payment, Service, User, Gallery } = require('../models');
const { successResponse, errorResponse } = require('../utils/response');
const logger = require('../utils/logger');
const { Sequelize } = require('sequelize');

const reportController = {
  getDashboardMetrics: async (req, res) => {
    try {
      const [
        totalUsers,
        totalBookings,
        totalRevenue,
        totalGallery,
        totalServices,
        pendingBookings,
        activeUsers,
        serviceDistribution,
        recentBookings
      ] = await Promise.all([
        User.count(),
        Booking.count(),
        Payment.sum('amount', { where: { status: 'completed' } }),
        Gallery.count(),
        Service.count(),
        Booking.count({ where: { status: 'pending' } }),
        User.count({ where: { status: 'active' } }),
        Booking.findAll({
          attributes: [
            'eventType',
            [Sequelize.fn('COUNT', Sequelize.col('id')), 'count']
          ],
          group: ['eventType'],
          raw: true
        }),
        Booking.findAll({
          include: [{
            model: User,
            as: 'user',
            attributes: ['firstName', 'lastName']
          }],
          order: [['createdAt', 'DESC']],
          limit: 10
        })
      ]);

      const metrics = {
        totals: {
          users: totalUsers || 0,
          bookings: totalBookings || 0,
          revenue: totalRevenue || 0,
          gallery: totalGallery || 0,
          services: totalServices || 0,
          pendingBookings: pendingBookings || 0,
          activeUsers: activeUsers || 0
        },
        serviceDistribution: serviceDistribution.reduce((acc, item) => {
          acc[item.eventType] = parseInt(item.count);
          return acc;
        }, {}),
        recentActivity: recentBookings
      };

      return successResponse(res, metrics);
    } catch (error) {
      logger.error('Get dashboard metrics error:', error);
      return errorResponse(res, 'Failed to get dashboard metrics', 500);
    }
  },

  getBookingsOverTime: async (req, res) => {
    try {
      const { from, to, groupBy = 'day' } = req.query;

      let whereClause = {};
      if (from && to) {
        whereClause.createdAt = {
          [Sequelize.Op.between]: [new Date(from), new Date(to)]
        };
      }

      const unit = ['hour', 'week', 'month', 'day'].includes(String(groupBy)) ? String(groupBy) : 'day';
      const periodExpr = Sequelize.fn('date_trunc', unit, Sequelize.col('createdAt'));

      const bookingsOverTime = await Booking.findAll({
        attributes: [
          [periodExpr, 'period'],
          [Sequelize.fn('COUNT', Sequelize.col('id')), 'count']
        ],
        where: whereClause,
        group: [periodExpr],
        order: [[periodExpr, 'ASC']],
        raw: true
      });

      return successResponse(res, bookingsOverTime);
    } catch (error) {
      logger.error('Get bookings over time error:', error);
      return errorResponse(res, 'Failed to get bookings over time', 500);
    }
  },

  getRevenueOverTime: async (req, res) => {
    try {
      const { from, to, groupBy = 'day' } = req.query;

      let whereClause = { status: 'completed' };
      if (from && to) {
        whereClause.createdAt = {
          [Sequelize.Op.between]: [new Date(from), new Date(to)]
        };
      }

      const unit = ['hour', 'week', 'month', 'day'].includes(String(groupBy)) ? String(groupBy) : 'day';
      const periodExpr = Sequelize.fn('date_trunc', unit, Sequelize.col('createdAt'));

      const revenueOverTime = await Payment.findAll({
        attributes: [
          [periodExpr, 'period'],
          [Sequelize.fn('SUM', Sequelize.col('amount')), 'revenue'],
          [Sequelize.fn('COUNT', Sequelize.col('id')), 'transactions']
        ],
        where: whereClause,
        group: [periodExpr],
        order: [[periodExpr, 'ASC']],
        raw: true
      });

      return successResponse(res, revenueOverTime);
    } catch (error) {
      logger.error('Get revenue over time error:', error);
      return errorResponse(res, 'Failed to get revenue over time', 500);
    }
  },

  getServiceDistribution: async (req, res) => {
    try {
      const serviceDistribution = await Booking.findAll({
        attributes: [
          'eventType',
          [Sequelize.fn('COUNT', Sequelize.col('id')), 'bookings'],
          [Sequelize.fn('SUM', Sequelize.col('priceCalculated')), 'revenue']
        ],
        group: ['eventType'],
        order: [[Sequelize.col('bookings'), 'DESC']],
        raw: true
      });

      return successResponse(res, serviceDistribution);
    } catch (error) {
      logger.error('Get service distribution error:', error);
      return errorResponse(res, 'Failed to get service distribution', 500);
    }
  },

  getUserGrowthOverTime: async (req, res) => {
    try {
      const { from, to, groupBy = 'day' } = req.query;

      let whereClause = {};
      if (from && to) {
        whereClause.createdAt = {
          [Sequelize.Op.between]: [new Date(from), new Date(to)]
        };
      }

      const unit = ['hour', 'week', 'month', 'day'].includes(String(groupBy)) ? String(groupBy) : 'day';
      const periodExpr = Sequelize.fn('date_trunc', unit, Sequelize.col('createdAt'));

      const usersOverTime = await User.findAll({
        attributes: [
          [periodExpr, 'period'],
          [Sequelize.fn('COUNT', Sequelize.col('id')), 'count']
        ],
        where: whereClause,
        group: [periodExpr],
        order: [[periodExpr, 'ASC']],
        raw: true
      });

      return successResponse(res, usersOverTime);
    } catch (error) {
      logger.error('Get user growth over time error:', error);
      return errorResponse(res, 'Failed to get user growth over time', 500);
    }
  },

  getTrafficSource: async (req, res) => {
    try {
      // This would typically come from analytics data
      // For now, we'll return mock data
      const trafficSources = [
        { source: 'Direct', visitors: 45, conversions: 12 },
        { source: 'Google', visitors: 120, conversions: 34 },
        { source: 'Facebook', visitors: 78, conversions: 23 },
        { source: 'Instagram', visitors: 56, conversions: 18 },
        { source: 'Referral', visitors: 34, conversions: 9 }
      ];

      return successResponse(res, trafficSources);
    } catch (error) {
      logger.error('Get traffic source error:', error);
      return errorResponse(res, 'Failed to get traffic source data', 500);
    }
  }
};

module.exports = reportController;