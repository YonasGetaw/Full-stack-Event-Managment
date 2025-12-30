const Joi = require('joi');
const path = require('path');
const fs = require('fs');
const { Gallery, AuditLog, GalleryReaction } = require('../models');
const { Op } = require('sequelize');
const { successResponse, errorResponse, validationErrorResponse } = require('../utils/response');
const logger = require('../utils/logger');

// Validation schemas
const createGalleryItemSchema = Joi.object({
  title: Joi.string().min(2).max(100).required(),
  description: Joi.string().max(1000).optional(),
  category: Joi.string().valid(
    'wedding', 'birthday', 'corporate', 'decoration', 'catering', 'other'
  ).required(),
  location: Joi.string().max(100).optional(),
  date: Joi.date().optional(),
});

const updateGalleryItemSchema = Joi.object({
  title: Joi.string().min(2).max(100),
  description: Joi.string().max(1000),
  category: Joi.string().valid(
    'wedding', 'birthday', 'corporate', 'decoration', 'catering', 'other'
  ),
  location: Joi.string().max(100),
  date: Joi.date(),
}).min(1);

const setGalleryReactionSchema = Joi.object({
  reaction: Joi.string().valid('like', 'dislike').allow(null, ''),
});

const buildReactionMaps = async ({ galleryIds, userId }) => {
  const ids = Array.isArray(galleryIds) ? galleryIds.filter(Boolean) : [];
  if (ids.length === 0) {
    return { countsByGalleryId: new Map(), myReactionByGalleryId: new Map() };
  }

  const counts = await GalleryReaction.findAll({
    attributes: [
      'galleryId',
      'reaction',
      [require('sequelize').fn('COUNT', require('sequelize').col('id')), 'count'],
    ],
    where: { galleryId: { [Op.in]: ids } },
    group: ['galleryId', 'reaction'],
    raw: true,
  });

  const countsByGalleryId = new Map();
  counts.forEach((row) => {
    const gid = row.galleryId;
    const reaction = row.reaction;
    const count = Number(row.count || 0);
    if (!countsByGalleryId.has(gid)) {
      countsByGalleryId.set(gid, { likeCount: 0, dislikeCount: 0 });
    }
    const current = countsByGalleryId.get(gid);
    if (reaction === 'like') current.likeCount = count;
    if (reaction === 'dislike') current.dislikeCount = count;
  });

  const myReactionByGalleryId = new Map();
  if (userId) {
    const mine = await GalleryReaction.findAll({
      attributes: ['galleryId', 'reaction'],
      where: { userId, galleryId: { [Op.in]: ids } },
      raw: true,
    });
    mine.forEach((r) => myReactionByGalleryId.set(r.galleryId, r.reaction));
  }

  return { countsByGalleryId, myReactionByGalleryId };
};

const galleryController = {
  createGalleryItem: async (req, res) => {
    try {
      const { error, value } = createGalleryItemSchema.validate(req.body, {
        abortEarly: false,
        convert: true,
        allowUnknown: true,
      });
      if (error) {
        return validationErrorResponse(res, error);
      }

      if (!req.file) {
        return errorResponse(res, 'Image file is required', 400);
      }

      const galleryItem = await Gallery.create({
        ...value,
        imageFilename: req.file.filename,
        imageUrl: `/uploads/gallery/${req.file.filename}`,
      });

      // Log audit
      await AuditLog.create({
        userId: req.user.id,
        action: 'create_gallery_item',
        resourceType: 'gallery',
        resourceId: galleryItem.id,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        data: { title: galleryItem.title, category: galleryItem.category }
      });

      return successResponse(res, galleryItem, 'Gallery item created successfully', 201);
    } catch (error) {
      logger.error('Create gallery item error:', error);
      return errorResponse(res, 'Failed to create gallery item', 500);
    }
  },

  getAllGalleryItems: async (req, res) => {
    try {
      const { page = 1, limit = 20, category, search } = req.query;
      const offset = (page - 1) * limit;

      const whereClause = {};
      if (category) whereClause.category = category;

      if (search) {
        whereClause[require('sequelize').Op.or] = [
          { title: { [require('sequelize').Op.iLike]: `%${search}%` } },
          { description: { [require('sequelize').Op.iLike]: `%${search}%` } },
          { location: { [require('sequelize').Op.iLike]: `%${search}%` } }
        ];
      }

      const { count, rows: galleryItems } = await Gallery.findAndCountAll({
        where: whereClause,
        order: [['createdAt', 'DESC']],
        limit: parseInt(limit),
        offset: parseInt(offset)
      });

      const galleryIds = galleryItems.map((g) => g.id);
      const { countsByGalleryId, myReactionByGalleryId } = await buildReactionMaps({
        galleryIds,
        userId: req.user?.id,
      });

      const withReactions = galleryItems.map((g) => {
        const counts = countsByGalleryId.get(g.id) || { likeCount: 0, dislikeCount: 0 };
        const myReaction = myReactionByGalleryId.get(g.id) || null;
        return {
          ...g.toJSON(),
          likeCount: counts.likeCount,
          dislikeCount: counts.dislikeCount,
          myReaction,
        };
      });

      return successResponse(res, {
        galleryItems: withReactions,
        total: count,
        page: parseInt(page),
        totalPages: Math.ceil(count / limit)
      });
    } catch (error) {
      logger.error('Get all gallery items error:', error);
      return errorResponse(res, 'Failed to get gallery items', 500);
    }
  },

  getGalleryItem: async (req, res) => {
    try {
      const { id } = req.params;

      const galleryItem = await Gallery.findByPk(id);
      if (!galleryItem) {
        return errorResponse(res, 'Gallery item not found', 404);
      }

      const { countsByGalleryId, myReactionByGalleryId } = await buildReactionMaps({
        galleryIds: [galleryItem.id],
        userId: req.user?.id,
      });
      const counts = countsByGalleryId.get(galleryItem.id) || { likeCount: 0, dislikeCount: 0 };
      const myReaction = myReactionByGalleryId.get(galleryItem.id) || null;

      return successResponse(res, {
        ...galleryItem.toJSON(),
        likeCount: counts.likeCount,
        dislikeCount: counts.dislikeCount,
        myReaction,
      });
    } catch (error) {
      logger.error('Get gallery item error:', error);
      return errorResponse(res, 'Failed to get gallery item', 500);
    }
  },

  setGalleryReaction: async (req, res) => {
    try {
      const { id } = req.params;
      const { error, value } = setGalleryReactionSchema.validate(req.body, {
        abortEarly: false,
        convert: true,
        allowUnknown: true,
      });
      if (error) {
        return validationErrorResponse(res, error);
      }

      const galleryItem = await Gallery.findByPk(id);
      if (!galleryItem) {
        return errorResponse(res, 'Gallery item not found', 404);
      }

      const requested = value?.reaction;
      const normalized = requested === '' ? null : requested;

      if (!normalized) {
        await GalleryReaction.destroy({ where: { galleryId: id, userId: req.user.id } });
      } else {
        const [row] = await GalleryReaction.findOrCreate({
          where: { galleryId: id, userId: req.user.id },
          defaults: { reaction: normalized },
        });
        if (row.reaction !== normalized) {
          await row.update({ reaction: normalized });
        }
      }

      const { countsByGalleryId, myReactionByGalleryId } = await buildReactionMaps({
        galleryIds: [id],
        userId: req.user.id,
      });
      const counts = countsByGalleryId.get(id) || { likeCount: 0, dislikeCount: 0 };
      const myReaction = myReactionByGalleryId.get(id) || null;

      return successResponse(res, {
        galleryId: id,
        likeCount: counts.likeCount,
        dislikeCount: counts.dislikeCount,
        myReaction,
      });
    } catch (error) {
      logger.error('Set gallery reaction error:', error);
      return errorResponse(res, 'Failed to set reaction', 500);
    }
  },

  updateGalleryItem: async (req, res) => {
    try {
      const { error, value } = updateGalleryItemSchema.validate(req.body, {
        abortEarly: false,
        convert: true,
        allowUnknown: true,
      });
      if (error) {
        return validationErrorResponse(res, error);
      }

      const { id } = req.params;
      const galleryItem = await Gallery.findByPk(id);

      if (!galleryItem) {
        return errorResponse(res, 'Gallery item not found', 404);
      }

      await galleryItem.update(value);

      // Log audit
      await AuditLog.create({
        userId: req.user.id,
        action: 'update_gallery_item',
        resourceType: 'gallery',
        resourceId: id,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        data: value
      });

      return successResponse(res, galleryItem, 'Gallery item updated successfully');
    } catch (error) {
      logger.error('Update gallery item error:', error);
      return errorResponse(res, 'Failed to update gallery item', 500);
    }
  },

  deleteGalleryItem: async (req, res) => {
    try {
      const { id } = req.params;

      const galleryItem = await Gallery.findByPk(id);
      if (!galleryItem) {
        return errorResponse(res, 'Gallery item not found', 404);
      }

      // Delete image file
      const imagePath = path.join(__dirname, '..', galleryItem.imageUrl);
      if (fs.existsSync(imagePath)) {
        fs.unlinkSync(imagePath);
      }

      await galleryItem.destroy();

      // Log audit
      await AuditLog.create({
        userId: req.user.id,
        action: 'delete_gallery_item',
        resourceType: 'gallery',
        resourceId: id,
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });

      return successResponse(res, null, 'Gallery item deleted successfully');
    } catch (error) {
      logger.error('Delete gallery item error:', error);
      return errorResponse(res, 'Failed to delete gallery item', 500);
    }
  }
};

module.exports = galleryController;