const Joi = require('joi');
const { Payment, Booking, Event, AuditLog, User } = require('../models');
const { successResponse, errorResponse, validationErrorResponse } = require('../utils/response');
const PaymentService = require('../services/paymentService');
const logger = require('../utils/logger');

const { Op, fn, col, literal } = require('sequelize');

// Validation schemas
const processPaymentSchema = Joi.object({
  simulateSuccess: Joi.boolean().default(true),
});

const getMyEventTickets = async (req, res) => {
    try {
      const { page = 1, limit = 20, status, search } = req.query;
      const offset = (page - 1) * limit;

      const whereClause = {
        userId: req.user.id,
        eventId: { [Op.ne]: null },
      };
      if (status) whereClause.status = status;

      if (search) {
        whereClause[Op.or] = [
          { '$event.title$': { [Op.iLike]: `%${search}%` } },
          { '$event.eventType$': { [Op.iLike]: `%${search}%` } },
          { transactionId: { [Op.iLike]: `%${search}%` } },
        ];
      }

      const { count, rows } = await Payment.findAndCountAll({
        where: whereClause,
        include: [
          { model: Event, as: 'event', attributes: ['id', 'title', 'eventType', 'eventDate', 'eventTime'] },
        ],
        order: [['createdAt', 'DESC']],
        limit: parseInt(limit),
        offset: parseInt(offset),
      });

      return successResponse(res, {
        payments: rows,
        total: count,
        page: parseInt(page),
        totalPages: Math.ceil(count / limit),
      });
    } catch (e) {
      logger.error('Get my event tickets error:', e);
      return errorResponse(res, 'Failed to get event tickets', 500);
    }
  };

const paymentController = {
  getMyEventTickets,

  processPayment: async (req, res) => {
    try {
      const { error, value } = processPaymentSchema.validate(req.body);
      if (error) {
        return validationErrorResponse(res, error);
      }

      const { id } = req.params;
      const { simulateSuccess } = value;

      const payment = await PaymentService.processPayment(id, simulateSuccess);

      // Log audit
      await AuditLog.create({
        userId: req.user.id,
        action: 'process_payment',
        resourceType: 'payment',
        resourceId: id,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        data: { simulateSuccess, status: payment.status }
      });

      return successResponse(res, payment, 'Payment processed successfully');
    } catch (error) {
      logger.error('Process payment error:', error);
      return errorResponse(res, 'Failed to process payment', 500);
    }
  },

  getPayment: async (req, res) => {
    try {
      const { id } = req.params;

      const payment = await Payment.findByPk(id, {
        include: [{
          model: Booking,
          as: 'booking',
          attributes: ['id', 'customerName', 'customerEmail', 'eventType']
        }, {
          model: Event,
          as: 'event',
          attributes: ['id', 'title', 'eventDate', 'eventTime']
        }]
      });

      if (!payment) {
        return errorResponse(res, 'Payment not found', 404);
      }

      // Check permissions
      if (req.user.role !== 'admin') {
        if (payment.bookingId) {
          const booking = await Booking.findByPk(payment.bookingId);
          if (booking?.userId !== req.user.id) {
            return errorResponse(res, 'Access denied', 403);
          }
        } else if (payment.userId && payment.userId !== req.user.id) {
          return errorResponse(res, 'Access denied', 403);
        }
      }

      return successResponse(res, payment);
    } catch (error) {
      logger.error('Get payment error:', error);
      return errorResponse(res, 'Failed to get payment', 500);
    }
  },

  getAllPayments: async (req, res) => {
    try {
      const { page = 1, limit = 20, status, paymentMethod } = req.query;
      const offset = (page - 1) * limit;

      const whereClause = {};
      if (status) whereClause.status = status;
      if (paymentMethod) whereClause.paymentMethod = paymentMethod;

      const { count, rows: payments } = await Payment.findAndCountAll({
        where: whereClause,
        include: [{
          model: Booking,
          as: 'booking',
          attributes: ['id', 'customerName', 'customerEmail']
        }, {
          model: Event,
          as: 'event',
          attributes: ['id', 'title']
        }],
        order: [['createdAt', 'DESC']],
        limit: parseInt(limit),
        offset: parseInt(offset)
      });

      return successResponse(res, {
        payments,
        total: count,
        page: parseInt(page),
        totalPages: Math.ceil(count / limit)
      });
    } catch (error) {
      logger.error('Get all payments error:', error);
      return errorResponse(res, 'Failed to get payments', 500);
    }
  },

  getUserPayments: async (req, res) => {
    try {
      const { page = 1, limit = 20, status } = req.query;
      const offset = (page - 1) * limit;

      const whereClause = {};
      if (status) whereClause.status = status;

      // Get user's bookings
      const userBookings = await Booking.findAll({
        where: { userId: req.user.id },
        attributes: ['id']
      });
      const bookingIds = userBookings.map(booking => booking.id);

      whereClause[Op.or] = [
        { bookingId: bookingIds },
        { userId: req.user.id },
      ];

      const { count, rows: payments } = await Payment.findAndCountAll({
        where: whereClause,
        include: [
          {
            model: Booking,
            as: 'booking',
            attributes: ['id', 'eventType', 'eventDate'],
            required: false,
          },
          {
            model: Event,
            as: 'event',
            attributes: ['id', 'title', 'eventDate', 'eventTime'],
            required: false,
          },
          {
            model: User,
            as: 'user',
            attributes: ['id', 'firstName', 'lastName', 'email', 'phone'],
            required: false,
          },
        ],
        order: [['createdAt', 'DESC']],
        limit: parseInt(limit),
        offset: parseInt(offset)
      });

      return successResponse(res, {
        payments,
        total: count,
        page: parseInt(page),
        totalPages: Math.ceil(count / limit)
      });
    } catch (error) {
      logger.error('Get user payments error:', error);
      return errorResponse(res, 'Failed to get payments', 500);
    }
  },

  getEventPayments: async (req, res) => {
    try {
      const { page = 1, limit = 20, status, search } = req.query;
      const offset = (page - 1) * limit;

      const whereClause = { eventId: { [Op.ne]: null } };
      if (status) whereClause.status = status;

      if (search) {
        whereClause[Op.and] = [
          { eventId: { [Op.ne]: null } },
          {
            [Op.or]: [
              { '$event.title$': { [Op.iLike]: `%${search}%` } },
              { '$user.firstName$': { [Op.iLike]: `%${search}%` } },
              { '$user.lastName$': { [Op.iLike]: `%${search}%` } },
              { '$user.email$': { [Op.iLike]: `%${search}%` } },
              { transactionId: { [Op.iLike]: `%${search}%` } },
            ],
          },
        ];
      }

      const { count, rows: payments } = await Payment.findAndCountAll({
        where: whereClause,
        include: [
          {
            model: Event,
            as: 'event',
            attributes: ['id', 'title', 'eventDate', 'eventTime', 'eventType'],
          },
          {
            model: User,
            as: 'user',
            attributes: ['id', 'firstName', 'lastName', 'email', 'phone'],
          },
        ],
        order: [['createdAt', 'DESC']],
        limit: parseInt(limit),
        offset: parseInt(offset),
      });

      return successResponse(res, {
        payments,
        total: count,
        page: parseInt(page),
        totalPages: Math.ceil(count / limit),
      });
    } catch (error) {
      logger.error('Get event payments error:', error);
      return errorResponse(res, 'Failed to get event payments', 500);
    }
  },

  uploadProof: async (req, res) => {
    try {
      const { id } = req.params;
      const payment = await Payment.findByPk(id);
      if (!payment) return errorResponse(res, 'Payment not found', 404);

      let booking = null;
      if (payment.bookingId) {
        booking = await Booking.findByPk(payment.bookingId);
        if (!booking) return errorResponse(res, 'Booking not found', 404);
      }

      if (req.user.role !== 'admin') {
        const ownerId = booking?.userId || payment.userId || null;
        if (!ownerId || ownerId !== req.user.id) {
          return errorResponse(res, 'Access denied', 403);
        }
      }

      const file = req.file;
      if (!file) {
        return errorResponse(res, 'Proof image is required', 400);
      }

      const proofUrl = `/uploads/payments/${file.filename}`;

      await payment.update({
        proofImageUrl: proofUrl,
        proofUploadedAt: new Date(),
      });

      await AuditLog.create({
        userId: req.user.id,
        action: 'upload_payment_proof',
        resourceType: 'payment',
        resourceId: payment.id,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        data: { bookingId: booking?.id || null, eventId: payment.eventId || null, proofImageUrl: proofUrl },
      });

      return successResponse(res, payment, 'Payment proof uploaded');
    } catch (error) {
      logger.error('Upload payment proof error:', error);
      return errorResponse(res, 'Failed to upload payment proof', 500);
    }
  },

  handleWebhook: async (req, res) => {
    try {
      const webhookData = req.body;

      const result = await PaymentService.handlePaymentWebhook(webhookData);

      // Log audit
      await AuditLog.create({
        action: 'payment_webhook',
        resourceType: 'payment',
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        data: webhookData
      });

      return successResponse(res, result, 'Webhook processed successfully');
    } catch (error) {
      logger.error('Payment webhook error:', error);
      return errorResponse(res, 'Webhook processing failed', 500);
    }
  }
};

module.exports = paymentController;