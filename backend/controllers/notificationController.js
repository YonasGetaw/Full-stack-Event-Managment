const { Notification } = require('../models');
const NotificationService = require('../services/notificationService');
const { successResponse, errorResponse } = require('../utils/response');
const logger = require('../utils/logger');

const notificationController = {
  createAdminNotification: async (req, res) => {
    try {
      const { title, message, type } = req.body;

      if (!title || !message || !type) {
        return errorResponse(res, 'Title, message, and type are required', 400);
      }

      const notification = await Notification.create({
        userId: null, // Admin notification
        title,
        message,
        type,
        read: false,
      });

      return successResponse(res, notification, 'Admin notification created successfully');
    } catch (error) {
      logger.error('Create admin notification error:', error);
      return errorResponse(res, 'Failed to create admin notification', 500);
    }
  },

  getUserNotifications: async (req, res) => {
    try {
      const { page = 1, limit = 20 } = req.query;

      const result = await NotificationService.getUserNotifications(
        req.user.id,
        parseInt(page),
        parseInt(limit)
      );

      return successResponse(res, result);
    } catch (error) {
      logger.error('Get user notifications error:', error);
      return errorResponse(res, 'Failed to get notifications', 500);
    }
  },

  getAdminNotifications: async (req, res) => {
    try {
      const { page = 1, limit = 20 } = req.query;

      const { count, rows } = await Notification.findAndCountAll({
        where: { userId: null }, // admin notifications have userId null
        order: [['createdAt', 'DESC']],
        limit: parseInt(limit),
        offset: (parseInt(page) - 1) * parseInt(limit),
      });

      return successResponse(res, {
        notifications: rows,
        total: count,
        page: parseInt(page),
        totalPages: Math.ceil(count / limit),
      });
    } catch (error) {
      logger.error('Get admin notifications error:', error);
      return errorResponse(res, 'Failed to get admin notifications', 500);
    }
  },

  markAdminNotificationAsRead: async (req, res) => {
    try {
      const { id } = req.params;

      const notification = await Notification.findByPk(id);
      if (!notification) return errorResponse(res, 'Notification not found', 404);
      if (notification.userId !== null) return errorResponse(res, 'Not an admin notification', 403);

      await notification.update({ read: true });

      return successResponse(res, notification, 'Notification marked as read');
    } catch (error) {
      logger.error('Mark admin notification as read error:', error);
      return errorResponse(res, 'Failed to mark notification as read', 500);
    }
  },

  markAllAdminNotificationsAsRead: async (req, res) => {
    try {
      const [count] = await Notification.update(
        { read: true },
        { where: { userId: null, read: false } }
      );

      return successResponse(res, { count }, 'All admin notifications marked as read');
    } catch (error) {
      logger.error('Mark all admin notifications as read error:', error);
      return errorResponse(res, 'Failed to mark admin notifications as read', 500);
    }
  },

  getAdminUnreadCount: async (req, res) => {
    try {
      const count = await Notification.count({
        where: { userId: null, read: false },
      });

      return successResponse(res, { count });
    } catch (error) {
      logger.error('Get admin unread count error:', error);
      return errorResponse(res, 'Failed to get admin unread count', 500);
    }
  },

  markAsRead: async (req, res) => {
    try {
      const { id } = req.params;

      const notification = await NotificationService.markAsRead(id, req.user.id);

      return successResponse(res, notification, 'Notification marked as read');
    } catch (error) {
      logger.error('Mark notification as read error:', error);
      return errorResponse(res, 'Failed to mark notification as read', 500);
    }
  },

  markAllAsRead: async (req, res) => {
    try {
      const count = await NotificationService.markAllAsRead(req.user.id);

      return successResponse(res, { count }, 'All notifications marked as read');
    } catch (error) {
      logger.error('Mark all notifications as read error:', error);
      return errorResponse(res, 'Failed to mark notifications as read', 500);
    }
  },

  getUnreadCount: async (req, res) => {
    try {
      const count = await NotificationService.getUnreadCount(req.user.id);

      return successResponse(res, { count });
    } catch (error) {
      logger.error('Get unread count error:', error);
      return errorResponse(res, 'Failed to get unread count', 500);
    }
  },

  deleteNotification: async (req, res) => {
    try {
      const { id } = req.params;

      const notification = await Notification.findOne({
        where: { id, userId: req.user.id }
      });

      if (!notification) {
        return errorResponse(res, 'Notification not found', 404);
      }

      await notification.destroy();

      return successResponse(res, null, 'Notification deleted successfully');
    } catch (error) {
      logger.error('Delete notification error:', error);
      return errorResponse(res, 'Failed to delete notification', 500);
    }
  }
};

module.exports = notificationController;