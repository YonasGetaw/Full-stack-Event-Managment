const Joi = require('joi');
const path = require('path');
const fs = require('fs');
const { Event, AuditLog, PaymentMethodConfig, Payment } = require('../models');
const { successResponse, errorResponse, validationErrorResponse } = require('../utils/response');
const PaymentService = require('../services/paymentService');
const logger = require('../utils/logger');

const createEventSchema = Joi.object({
  title: Joi.string().min(2).max(120).required(),
  description: Joi.string().max(5000).allow(''),
  eventType: Joi.string().valid('wedding', 'birthday', 'corporate', 'decoration', 'catering', 'other').required(),
  location: Joi.string().max(150).allow(''),
  latitude: Joi.number().min(-90).max(90).allow(null),
  longitude: Joi.number().min(-180).max(180).allow(null),
  eventDate: Joi.date().required(),
  eventTime: Joi.string().pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).required(),
  ticketPrice: Joi.number().integer().min(0).required(),
  totalTickets: Joi.number().integer().min(0).allow(null),
  status: Joi.string().valid('draft', 'published').default('draft'),
});

const updateEventSchema = Joi.object({
  title: Joi.string().min(2).max(120),
  description: Joi.string().max(5000).allow(''),
  eventType: Joi.string().valid('wedding', 'birthday', 'corporate', 'decoration', 'catering', 'other'),
  location: Joi.string().max(150).allow(''),
  latitude: Joi.number().min(-90).max(90).allow(null),
  longitude: Joi.number().min(-180).max(180).allow(null),
  eventDate: Joi.date(),
  eventTime: Joi.string().pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
  ticketPrice: Joi.number().integer().min(0),
  totalTickets: Joi.number().integer().min(0).allow(null),
  status: Joi.string().valid('draft', 'published'),
}).min(1);

const proceedPaymentSchema = Joi.object({
  paymentMethod: Joi.string().valid('telebirr', 'cbe', 'abisiniya', 'abyssinia', 'commercial').required(),
  phoneNumber: Joi.string().min(10).max(15).optional(),
});

const eventController = {
  createEvent: async (req, res) => {
    try {
      const { error, value } = createEventSchema.validate(req.body, {
        abortEarly: false,
        convert: true,
        allowUnknown: true,
      });
      if (error) return validationErrorResponse(res, error);

      const payload = { ...value };
      if (req.file) {
        payload.imageFilename = req.file.filename;
        payload.imageUrl = `/uploads/events/${req.file.filename}`;
      }

      const created = await Event.create(payload);

      await AuditLog.create({
        userId: req.user.id,
        action: 'create_event',
        resourceType: 'event',
        resourceId: created.id,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        data: { title: created.title, eventType: created.eventType, ticketPrice: created.ticketPrice },
      });

      return successResponse(res, created, 'Event created successfully', 201);
    } catch (e) {
      logger.error('Create event error:', e);
      return errorResponse(res, 'Failed to create event', 500);
    }
  },

  getAllEvents: async (req, res) => {
    try {
      const { page = 1, limit = 20, status, type, search } = req.query;
      const offset = (page - 1) * limit;

      const whereClause = {};
      if (status) whereClause.status = status;
      if (type) whereClause.eventType = type;

      if (search) {
        whereClause[require('sequelize').Op.or] = [
          { title: { [require('sequelize').Op.iLike]: `%${search}%` } },
          { description: { [require('sequelize').Op.iLike]: `%${search}%` } },
          { location: { [require('sequelize').Op.iLike]: `%${search}%` } },
        ];
      }

      // Public should only see published events
      if (!req.user || req.user.role !== 'admin') {
        whereClause.status = 'published';
      }

      const { count, rows } = await Event.findAndCountAll({
        where: whereClause,
        order: [
          ['eventDate', 'ASC'],
          ['eventTime', 'ASC'],
        ],
        limit: parseInt(limit),
        offset: parseInt(offset),
      });

      // Add remainingTickets for public responses
      const eventsWithRemaining = (!req.user || req.user.role !== 'admin')
        ? await Event.addRemainingTickets(rows)
        : rows;

      return successResponse(res, {
        events: eventsWithRemaining,
        total: count,
        page: parseInt(page),
        totalPages: Math.ceil(count / limit),
      });
    } catch (e) {
      logger.error('Get all events error:', e);
      return errorResponse(res, 'Failed to get events', 500);
    }
  },

  getEvent: async (req, res) => {
    try {
      const { id } = req.params;
      const event = await Event.findByPk(id);
      if (!event) return errorResponse(res, 'Event not found', 404);

      if ((!req.user || req.user.role !== 'admin') && event.status !== 'published') {
        return errorResponse(res, 'Event not found', 404);
      }

      // Add remainingTickets for public users
      const responseEvent = (!req.user || req.user.role !== 'admin')
        ? (await Event.addRemainingTickets([event]))[0]
        : event;

      return successResponse(res, responseEvent);
    } catch (e) {
      logger.error('Get event error:', e);
      return errorResponse(res, 'Failed to get event', 500);
    }
  },

  updateEvent: async (req, res) => {
    try {
      const { id } = req.params;
      const { error, value } = updateEventSchema.validate(req.body, {
        abortEarly: false,
        convert: true,
        allowUnknown: true,
      });
      if (error) return validationErrorResponse(res, error);

      const event = await Event.findByPk(id);
      if (!event) return errorResponse(res, 'Event not found', 404);

      // If new image uploaded, delete old file
      if (req.file) {
        if (event.imageUrl) {
          const rel = String(event.imageUrl).replace(/^\//, '');
          const filePath = path.join(__dirname, '..', rel);
          if (fs.existsSync(filePath)) {
            try {
              fs.unlinkSync(filePath);
            } catch {
              // ignore
            }
          }
        }
        value.imageFilename = req.file.filename;
        value.imageUrl = `/uploads/events/${req.file.filename}`;
      }

      await event.update(value);

      await AuditLog.create({
        userId: req.user.id,
        action: 'update_event',
        resourceType: 'event',
        resourceId: id,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        data: value,
      });

      return successResponse(res, event, 'Event updated successfully');
    } catch (e) {
      logger.error('Update event error:', e);
      return errorResponse(res, 'Failed to update event', 500);
    }
  },

  deleteEvent: async (req, res) => {
    try {
      const { id } = req.params;
      const event = await Event.findByPk(id);
      if (!event) return errorResponse(res, 'Event not found', 404);

      if (event.imageUrl) {
        const rel = String(event.imageUrl).replace(/^\//, '');
        const filePath = path.join(__dirname, '..', rel);
        if (fs.existsSync(filePath)) {
          try {
            fs.unlinkSync(filePath);
          } catch {
            // ignore
          }
        }
      }

      await event.destroy();

      await AuditLog.create({
        userId: req.user.id,
        action: 'delete_event',
        resourceType: 'event',
        resourceId: id,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
      });

      return successResponse(res, null, 'Event deleted successfully');
    } catch (e) {
      logger.error('Delete event error:', e);
      return errorResponse(res, 'Failed to delete event', 500);
    }
  },

  proceedPayment: async (req, res) => {
    try {
      const { id } = req.params;
      const { error, value } = proceedPaymentSchema.validate(req.body);
      if (error) return validationErrorResponse(res, error);

      const event = await Event.findByPk(id);
      if (!event) return errorResponse(res, 'Event not found', 404);
      if (event.status !== 'published') return errorResponse(res, 'Event not available', 400);

      // Check remaining tickets
      if (event.totalTickets != null) {
        const soldCount = await Payment.count({
          where: { eventId: id, status: 'completed' },
        });
        const remaining = event.totalTickets - soldCount;
        if (remaining <= 0) {
          return errorResponse(res, 'No tickets remaining for this event', 400);
        }
      }

      const { paymentMethod, phoneNumber } = value;
      const normalizedMethod = paymentMethod === 'abyssinia' ? 'abisiniya' : paymentMethod;

      const payment = await PaymentService.createEventPayment(id, req.user.id, {
        paymentMethod: normalizedMethod,
        phoneNumber,
      });

      const instructions = await PaymentService.getPaymentInstructions(
        normalizedMethod,
        payment.amount,
        phoneNumber
      );

      const receiver = await PaymentMethodConfig.findOne({ where: { method: normalizedMethod } });
      const receiverInfo = receiver
        ? {
            method: receiver.method,
            receiverName: receiver.receiverName,
            receiverPhone: receiver.receiverPhone,
            receiverAccountNumber: receiver.receiverAccountNumber,
            note: receiver.note,
            active: receiver.active,
          }
        : null;

      return successResponse(
        res,
        {
          payment,
          instructions,
          receiver: receiverInfo,
          event: { id: event.id, title: event.title, ticketPrice: event.ticketPrice },
        },
        'Payment initiated successfully'
      );
    } catch (e) {
      logger.error('Proceed event payment error:', e);
      return errorResponse(res, 'Failed to initiate payment', 500);
    }
  },
};

module.exports = eventController;
