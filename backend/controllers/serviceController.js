const Joi = require('joi');
const path = require('path');
const fs = require('fs');
const { Service, AuditLog } = require('../models');
const { successResponse, errorResponse, validationErrorResponse } = require('../utils/response');
const logger = require('../utils/logger');

// Validation schemas
const createServiceSchema = Joi.object({
  name: Joi.string().min(2).max(100).required(),
  description: Joi.string().max(1000).optional(),
  price: Joi.number().integer().min(0).required(),
  category: Joi.string().valid(
    'catering', 'decoration', 'entertainment', 'photography', 'venue', 'other'
  ).required(),
  featured: Joi.boolean().optional(),
});

const updateServiceSchema = Joi.object({
  name: Joi.string().min(2).max(100),
  description: Joi.string().max(1000),
  price: Joi.number().integer().min(0),
  category: Joi.string().valid(
    'catering', 'decoration', 'entertainment', 'photography', 'venue', 'other'
  ),
  status: Joi.string().valid('active', 'inactive'),
  featured: Joi.boolean(),
}).min(1);

const serviceController = {
  createService: async (req, res) => {
    try {
      const { error, value } = createServiceSchema.validate(req.body, {
        abortEarly: false,
        convert: true,
        allowUnknown: true,
      });
      if (error) {
        return validationErrorResponse(res, error);
      }

      const service = await Service.create({
        ...value,
        currency: 'ETB',
        images: req.files ? req.files.map(file => `/uploads/services/${file.filename}`) : [],
      });

      // Log audit
      await AuditLog.create({
        userId: req.user.id,
        action: 'create_service',
        resourceType: 'service',
        resourceId: service.id,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        data: { name: service.name, price: service.price }
      });

      return successResponse(res, service, 'Service created successfully', 201);
    } catch (error) {
      logger.error('Create service error:', error);
      return errorResponse(res, 'Failed to create service', 500);
    }
  },

  getAllServices: async (req, res) => {
    try {
      const { page = 1, limit = 20, category, featured, status, search } = req.query;
      const offset = (page - 1) * limit;

      const whereClause = {};
      if (category) whereClause.category = category;
      if (featured !== undefined) whereClause.featured = featured === 'true';
      if (status) whereClause.status = status;

      if (search) {
        whereClause[require('sequelize').Op.or] = [
          { name: { [require('sequelize').Op.iLike]: `%${search}%` } },
          { description: { [require('sequelize').Op.iLike]: `%${search}%` } }
        ];
      }

      const { count, rows: services } = await Service.findAndCountAll({
        where: whereClause,
        order: [['createdAt', 'DESC']],
        limit: parseInt(limit),
        offset: parseInt(offset)
      });

      return successResponse(res, {
        services,
        total: count,
        page: parseInt(page),
        totalPages: Math.ceil(count / limit)
      });
    } catch (error) {
      logger.error('Get all services error:', error);
      return errorResponse(res, 'Failed to get services', 500);
    }
  },

  getService: async (req, res) => {
    try {
      const { id } = req.params;

      const service = await Service.findByPk(id);
      if (!service) {
        return errorResponse(res, 'Service not found', 404);
      }

      return successResponse(res, service);
    } catch (error) {
      logger.error('Get service error:', error);
      return errorResponse(res, 'Failed to get service', 500);
    }
  },

  updateService: async (req, res) => {
    try {
      const { error, value } = updateServiceSchema.validate(req.body, {
        abortEarly: false,
        convert: true,
        allowUnknown: true,
      });
      if (error) {
        return validationErrorResponse(res, error);
      }

      const { id } = req.params;
      const service = await Service.findByPk(id);

      if (!service) {
        return errorResponse(res, 'Service not found', 404);
      }

      const updateData = { ...value };
      if (req.files && req.files.length > 0) {
        updateData.images = [
          ...service.images,
          ...req.files.map(file => `/uploads/services/${file.filename}`)
        ];
      }

      await service.update(updateData);

      // Log audit
      await AuditLog.create({
        userId: req.user.id,
        action: 'update_service',
        resourceType: 'service',
        resourceId: id,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        data: value
      });

      return successResponse(res, service, 'Service updated successfully');
    } catch (error) {
      logger.error('Update service error:', error);
      return errorResponse(res, 'Failed to update service', 500);
    }
  },

  deleteService: async (req, res) => {
    try {
      const { id } = req.params;

      const service = await Service.findByPk(id);
      if (!service) {
        return errorResponse(res, 'Service not found', 404);
      }

      // Delete associated images
      if (service.images && service.images.length > 0) {
        service.images.forEach(imagePath => {
          const fullPath = path.join(__dirname, '..', imagePath);
          if (fs.existsSync(fullPath)) {
            fs.unlinkSync(fullPath);
          }
        });
      }

      await service.destroy();

      // Log audit
      await AuditLog.create({
        userId: req.user.id,
        action: 'delete_service',
        resourceType: 'service',
        resourceId: id,
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });

      return successResponse(res, null, 'Service deleted successfully');
    } catch (error) {
      logger.error('Delete service error:', error);
      return errorResponse(res, 'Failed to delete service', 500);
    }
  },

  deleteServiceImage: async (req, res) => {
    try {
      const { id, imageIndex } = req.params;

      const service = await Service.findByPk(id);
      if (!service) {
        return errorResponse(res, 'Service not found', 404);
      }

      if (!service.images || service.images.length <= imageIndex) {
        return errorResponse(res, 'Image not found', 404);
      }

      const imagePath = service.images[imageIndex];
      const fullPath = path.join(__dirname, '..', imagePath);

      // Delete file from filesystem
      if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath);
      }

      // Remove from images array
      const updatedImages = service.images.filter((_, index) => index !== parseInt(imageIndex));
      await service.update({ images: updatedImages });

      // Log audit
      await AuditLog.create({
        userId: req.user.id,
        action: 'delete_service_image',
        resourceType: 'service',
        resourceId: id,
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });

      return successResponse(res, service, 'Image deleted successfully');
    } catch (error) {
      logger.error('Delete service image error:', error);
      return errorResponse(res, 'Failed to delete image', 500);
    }
  }
};

module.exports = serviceController;