const Joi = require('joi');
const path = require('path');
const fs = require('fs');
const { User, AuditLog, Gallery } = require('../models');
const { successResponse, errorResponse, validationErrorResponse } = require('../utils/response');
const logger = require('../utils/logger');
const { Sequelize } = require('sequelize');

const getProfileImageUrl = (profileImage) => {
  if (!profileImage) return null;
  // If it's already a full URL, return as is
  if (profileImage.startsWith('http')) return profileImage;
  // If it's a relative path starting with /uploads, construct full URL
  const baseUrl = process.env.NODE_ENV === 'production' 
    ? (process.env.FRONTEND_URL || 'http://localhost:5173')
    : 'http://localhost:4001';
  return profileImage.startsWith('/') ? `${baseUrl}${profileImage}` : `${baseUrl}/${profileImage}`;
};

// Validation schemas
const updateProfileSchema = Joi.object({
  firstName: Joi.string().min(2).max(50),
  lastName: Joi.string().min(2).max(50),
  address: Joi.string().max(255),
  city: Joi.string().max(100),
  dob: Joi.date().max('now'),
  profileImage: Joi.string().uri().optional(),
}).min(1);

const updateUserSchema = Joi.object({
  firstName: Joi.string().min(2).max(50),
  lastName: Joi.string().min(2).max(50),
  email: Joi.string().email(),
  phone: Joi.string().min(10).max(15),
  role: Joi.string().valid('user', 'admin'),
  status: Joi.string().valid('active', 'inactive', 'pending', 'suspended'),
  profileImage: Joi.string().uri().optional(),
}).min(1);

const updateProfileImageSchema = Joi.object({
  galleryItemId: Joi.string().uuid().required(),
});

const userController = {
  // Get current user profile
  getMe: async (req, res) => {
    try {
      const user = req.user;
      return successResponse(res, {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        phone: user.phone,
        profileImage: getProfileImageUrl(user.profileImage),
        address: user.address,
        city: user.city,
        dob: user.dob,
        role: user.role,
        status: user.status,
        emailVerified: user.emailVerified,
        twoFactorEnabled: user.twoFactorEnabled,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
      });
    } catch (error) {
      logger.error('Get me error:', error);
      return errorResponse(res, 'Failed to get user data', 500);
    }
  },

  // Update user profile
  updateProfile: async (req, res) => {
    try {
      const { error, value } = updateProfileSchema.validate(req.body);
      if (error) {
        return validationErrorResponse(res, error);
      }

      const userId = req.user.id;
      const user = await User.findByPk(userId);

      if (!user) {
        return errorResponse(res, 'User not found', 404);
      }

      await user.update(value);

      // Log audit
      await AuditLog.create({
        userId,
        action: 'update_profile',
        resourceType: 'user',
        resourceId: userId,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        data: value
      });

      return successResponse(res, {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        phone: user.phone,
        profileImage: getProfileImageUrl(user.profileImage),
        address: user.address,
        city: user.city,
        dob: user.dob
      }, 'Profile updated successfully');
    } catch (error) {
      logger.error('Update profile error:', error);
      return errorResponse(res, 'Failed to update profile', 500);
    }
  },

  // Update profile image from gallery
  updateProfileImage: async (req, res) => {
    try {
      const { error, value } = updateProfileImageSchema.validate(req.body);
      if (error) {
        return validationErrorResponse(res, error);
      }

      const { galleryItemId } = value;
      const userId = req.user.id;

      // Get the gallery item
      const galleryItem = await Gallery.findByPk(galleryItemId);
      if (!galleryItem) {
        return errorResponse(res, 'Gallery item not found', 404);
      }

      // Update user's profile image
      const user = await User.findByPk(userId);
      if (!user) {
        return errorResponse(res, 'User not found', 404);
      }

      // Use the gallery image URL as profile image
      await user.update({
        profileImage: galleryItem.imageUrl
      });

      // Log audit
      await AuditLog.create({
        userId,
        action: 'update_profile_image',
        resourceType: 'user',
        resourceId: userId,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        data: { galleryItemId, imageUrl: galleryItem.imageUrl }
      });

      // Emit socket event for real-time update
      const io = req.app.get('io');
      if (io) {
        io.to(`user_${userId}`).emit('profile_image_updated', {
          userId,
          profileImage: galleryItem.imageUrl
        });
      }

      return successResponse(res, {
        profileImage: galleryItem.imageUrl
      }, 'Profile image updated successfully');
    } catch (error) {
      logger.error('Update profile image error:', error);
      return errorResponse(res, 'Failed to update profile image', 500);
    }
  },

  // Upload profile image via Multer file upload
  uploadProfileImage: async (req, res) => {
    try {
      if (!req.file) {
        return errorResponse(res, 'No image file provided', 400);
      }

      const userId = req.user.id;
      const user = await User.findByPk(userId);

      if (!user) {
        return errorResponse(res, 'User not found', 404);
      }

      // Delete old profile image if exists
      if (user.profileImage && user.profileImage.startsWith('/uploads/profile/')) {
        const oldImagePath = path.join(__dirname, '..', user.profileImage);
        if (fs.existsSync(oldImagePath)) {
          fs.unlinkSync(oldImagePath);
        }
      }

      // Update user with new profile image path
      const imageUrl = `/uploads/profile/${req.file.filename}`;
      await user.update({ profileImage: imageUrl });

      // Log audit
      await AuditLog.create({
        userId,
        action: 'upload_profile_image',
        resourceType: 'user',
        resourceId: userId,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        data: { imageUrl }
      });

      // Emit socket event for real-time update
      const io = req.app.get('io');
      if (io) {
        io.to(`user_${userId}`).emit('profile_image_updated', {
          userId,
          profileImage: getProfileImageUrl(imageUrl)
        });
      }

      return successResponse(res, {
        profileImage: getProfileImageUrl(imageUrl)
      }, 'Profile image uploaded successfully');
    } catch (error) {
      logger.error('Upload profile image error:', error);
      return errorResponse(res, 'Failed to upload profile image', 500);
    }
  },

  // Upload profile image for any user (admin only)
  uploadProfileImageAdmin: async (req, res) => {
    try {
      if (!req.file) {
        return errorResponse(res, 'No image file provided', 400);
      }

      const { id } = req.params;
      const user = await User.findByPk(id);

      if (!user) {
        return errorResponse(res, 'User not found', 404);
      }

      // Delete old profile image if exists
      if (user.profileImage && user.profileImage.startsWith('/uploads/profile/')) {
        const oldImagePath = path.join(__dirname, '..', user.profileImage);
        if (fs.existsSync(oldImagePath)) {
          fs.unlinkSync(oldImagePath);
        }
      }

      // Update user with new profile image path
      const imageUrl = `/uploads/profile/${req.file.filename}`;
      await user.update({ profileImage: imageUrl });

      // Log audit
      await AuditLog.create({
        userId: req.user.id,
        action: 'upload_profile_image_admin',
        resourceType: 'user',
        resourceId: id,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        data: { targetUserId: id, imageUrl }
      });

      // Emit socket event for real-time update
      const io = req.app.get('io');
      if (io) {
        io.to(`user_${id}`).emit('profile_image_updated', {
          userId: id,
          profileImage: imageUrl
        });
      }

      return successResponse(res, {
        profileImage: imageUrl
      }, 'Profile image uploaded successfully');
    } catch (error) {
      logger.error('Upload profile image admin error:', error);
      return errorResponse(res, 'Failed to upload profile image', 500);
    }
  },

  // Remove profile image
  removeProfileImage: async (req, res) => {
    try {
      const userId = req.user.id;
      const user = await User.findByPk(userId);

      if (!user) {
        return errorResponse(res, 'User not found', 404);
      }

      if (!user.profileImage) {
        return errorResponse(res, 'No profile image to remove', 400);
      }

      // Delete the image file (only if it's an uploaded file, not gallery image)
      if (user.profileImage.startsWith('/uploads/profile/')) {
        const imagePath = path.join(__dirname, '..', user.profileImage);
        if (fs.existsSync(imagePath)) {
          fs.unlinkSync(imagePath);
        }
      }

      // Update user to remove profile image
      await user.update({ profileImage: null });

      // Log audit
      await AuditLog.create({
        userId,
        action: 'remove_profile_image',
        resourceType: 'user',
        resourceId: userId,
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });

      // Emit socket event for real-time update
      const io = req.app.get('io');
      if (io) {
        io.to(`user_${userId}`).emit('profile_image_removed', {
          userId
        });
      }

      return successResponse(res, {
        profileImage: null
      }, 'Profile image removed successfully');
    } catch (error) {
      logger.error('Remove profile image error:', error);
      return errorResponse(res, 'Failed to remove profile image', 500);
    }
  },

  // Get gallery items suitable for profile pictures
  getProfileGalleryItems: async (req, res) => {
    try {
      const { page = 1, limit = 20 } = req.query;
      const offset = (page - 1) * limit;

      const { count, rows: galleryItems } = await Gallery.findAndCountAll({
        where: {
          // Filter for images suitable for profile pictures
          category: ['wedding', 'birthday', 'corporate', 'other']
        },
        attributes: ['id', 'title', 'imageUrl', 'category', 'createdAt'],
        order: [['createdAt', 'DESC']],
        limit: parseInt(limit),
        offset: parseInt(offset)
      });

      return successResponse(res, {
        galleryItems,
        total: count,
        page: parseInt(page),
        totalPages: Math.ceil(count / limit)
      });
    } catch (error) {
      logger.error('Get profile gallery items error:', error);
      return errorResponse(res, 'Failed to get gallery items', 500);
    }
  },

  // Admin only endpoints

  // Get all users (admin only)
  getAllUsers: async (req, res) => {
    try {
      const { page = 1, limit = 20, search, role, status } = req.query;
      const offset = (page - 1) * limit;

      const whereClause = {};
      if (search) {
        whereClause[Sequelize.Op.or] = [
          { firstName: { [Sequelize.Op.iLike]: `%${search}%` } },
          { lastName: { [Sequelize.Op.iLike]: `%${search}%` } },
          { email: { [Sequelize.Op.iLike]: `%${search}%` } },
          { phone: { [Sequelize.Op.iLike]: `%${search}%` } }
        ];
      }

      if (role) whereClause.role = role;
      if (status) whereClause.status = status;

      const { count, rows: users } = await User.findAndCountAll({
        where: whereClause,
        attributes: { exclude: ['passwordHash', 'verificationTokenHash', 'resetPasswordTokenHash'] },
        order: [['createdAt', 'DESC']],
        limit: parseInt(limit),
        offset: parseInt(offset)
      });

      return successResponse(res, {
        users,
        total: count,
        page: parseInt(page),
        totalPages: Math.ceil(count / limit)
      });
    } catch (error) {
      logger.error('Get all users error:', error);
      return errorResponse(res, 'Failed to get users', 500);
    }
  },

  // Get user by ID (admin only)
  getUserById: async (req, res) => {
    try {
      const { id } = req.params;

      const user = await User.findByPk(id, {
        attributes: { exclude: ['passwordHash', 'verificationTokenHash', 'resetPasswordTokenHash'] }
      });

      if (!user) {
        return errorResponse(res, 'User not found', 404);
      }

      return successResponse(res, user);
    } catch (error) {
      logger.error('Get user by id error:', error);
      return errorResponse(res, 'Failed to get user', 500);
    }
  },

  // Update user (admin only)
  updateUser: async (req, res) => {
    try {
      const { error, value } = updateUserSchema.validate(req.body);
      if (error) {
        return validationErrorResponse(res, error);
      }

      const { id } = req.params;
      const user = await User.findByPk(id);

      if (!user) {
        return errorResponse(res, 'User not found', 404);
      }

      // Check if email/phone already exists (excluding current user)
      if (value.email || value.phone) {
        const whereClause = {
          id: { [Sequelize.Op.ne]: id }
        };

        if (value.email && value.phone) {
          whereClause[Sequelize.Op.or] = [
            { email: value.email },
            { phone: value.phone }
          ];
        } else if (value.email) {
          whereClause.email = value.email;
        } else if (value.phone) {
          whereClause.phone = value.phone;
        }

        const existingUser = await User.findOne({ where: whereClause });
        if (existingUser) {
          return errorResponse(res, 'Email or phone already exists', 409);
        }
      }

      await user.update(value);

      // Log audit
      await AuditLog.create({
        userId: req.user.id,
        action: 'update_user',
        resourceType: 'user',
        resourceId: id,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        data: value
      });

      // Emit socket event if profile image was updated
      if (value.profileImage) {
        const io = req.app.get('io');
        if (io) {
          io.to(`user_${id}`).emit('profile_image_updated', {
            userId: id,
            profileImage: value.profileImage
          });
        }
      }

      return successResponse(res, {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        phone: user.phone,
        profileImage: user.profileImage,
        role: user.role,
        status: user.status
      }, 'User updated successfully');
    } catch (error) {
      logger.error('Update user error:', error);
      return errorResponse(res, 'Failed to update user', 500);
    }
  },

  // Delete user (admin only)
  deleteUser: async (req, res) => {
    try {
      const { id } = req.params;

      if (id === req.user.id) {
        return errorResponse(res, 'Cannot delete your own account', 400);
      }

      const user = await User.findByPk(id);
      if (!user) {
        return errorResponse(res, 'User not found', 404);
      }

      // Delete profile image file if it exists
      if (user.profileImage && user.profileImage.startsWith('/uploads/profile/')) {
        const imagePath = path.join(__dirname, '..', user.profileImage);
        if (fs.existsSync(imagePath)) {
          fs.unlinkSync(imagePath);
        }
      }

      await user.destroy();

      // Log audit
      await AuditLog.create({
        userId: req.user.id,
        action: 'delete_user',
        resourceType: 'user',
        resourceId: id,
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });

      return successResponse(res, null, 'User deleted successfully');
    } catch (error) {
      logger.error('Delete user error:', error);
      return errorResponse(res, 'Failed to delete user', 500);
    }
  }
};

module.exports = userController;