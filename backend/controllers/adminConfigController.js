const Joi = require('joi');
const { PricingRule, PaymentMethodConfig, AuditLog } = require('../models');
const { successResponse, errorResponse, validationErrorResponse } = require('../utils/response');
const logger = require('../utils/logger');

const upsertPricingRuleSchema = Joi.object({
  basePrice: Joi.number().integer().min(0).required(),
  perGuest: Joi.number().integer().min(0).required(),
  perHour: Joi.number().integer().min(0).required(),
  defaultHours: Joi.number().integer().min(1).required(),
});

const upsertPaymentMethodSchema = Joi.object({
  receiverName: Joi.string().allow('', null),
  receiverPhone: Joi.string().allow('', null),
  receiverAccountNumber: Joi.string().allow('', null),
  note: Joi.string().allow('', null),
  active: Joi.boolean().optional(),
});

const adminConfigController = {
  getPricingRules: async (req, res) => {
    try {
      const rules = await PricingRule.findAll({ order: [['eventType', 'ASC']] });
      return successResponse(res, { rules });
    } catch (error) {
      logger.error('Get pricing rules error:', error);
      return errorResponse(res, 'Failed to load pricing rules', 500);
    }
  },

  upsertPricingRule: async (req, res) => {
    try {
      const eventType = String(req.params.eventType || '');
      if (!['wedding', 'birthday', 'corporate', 'other'].includes(eventType)) {
        return errorResponse(res, 'Invalid event type', 400);
      }

      const { error, value } = upsertPricingRuleSchema.validate(req.body);
      if (error) return validationErrorResponse(res, error);

      const [rule] = await PricingRule.upsert({
        eventType,
        basePrice: value.basePrice,
        perGuest: value.perGuest,
        perHour: value.perHour,
        defaultHours: value.defaultHours,
      }, { returning: true });

      await AuditLog.create({
        userId: req.user.id,
        action: 'upsert_pricing_rule',
        resourceType: 'pricing_rule',
        resourceId: rule.id,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        data: { eventType, ...value },
      });

      return successResponse(res, rule, 'Pricing rule saved');
    } catch (error) {
      logger.error('Upsert pricing rule error:', error);
      return errorResponse(res, 'Failed to save pricing rule', 500);
    }
  },

  getPaymentMethodConfigs: async (req, res) => {
    try {
      const configs = await PaymentMethodConfig.findAll({ order: [['method', 'ASC']] });
      return successResponse(res, { configs });
    } catch (error) {
      logger.error('Get payment method configs error:', error);
      return errorResponse(res, 'Failed to load payment method configs', 500);
    }
  },

  upsertPaymentMethodConfig: async (req, res) => {
    try {
      const method = String(req.params.method || '').toLowerCase();
      const normalized = method === 'abyssinia' ? 'abisiniya' : method;
      if (!['telebirr', 'cbe', 'commercial', 'abisiniya'].includes(normalized)) {
        return errorResponse(res, 'Invalid payment method', 400);
      }

      const { error, value } = upsertPaymentMethodSchema.validate(req.body);
      if (error) return validationErrorResponse(res, error);

      const [config] = await PaymentMethodConfig.upsert({
        method: normalized,
        receiverName: value.receiverName || null,
        receiverPhone: value.receiverPhone || null,
        receiverAccountNumber: value.receiverAccountNumber || null,
        note: value.note || null,
        active: value.active !== undefined ? value.active : true,
      }, { returning: true });

      await AuditLog.create({
        userId: req.user.id,
        action: 'upsert_payment_method_config',
        resourceType: 'payment_method_config',
        resourceId: config.id,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        data: { method: normalized, ...value },
      });

      return successResponse(res, config, 'Payment method config saved');
    } catch (error) {
      logger.error('Upsert payment method config error:', error);
      return errorResponse(res, 'Failed to save payment method config', 500);
    }
  },
};

module.exports = adminConfigController;
