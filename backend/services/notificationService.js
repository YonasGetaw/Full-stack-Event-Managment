const { Notification, User } = require('../models');
const logger = require('../utils/logger');

class NotificationService {
  static async createNotification(userId, type, message, metadata = null) {
    try {
      const titleMap = {
        booking_created: 'New Booking Created',
        payment_created: 'New Payment Created',
        payment_completed: 'Payment Completed',
        payment_failed: 'Payment Failed',
        booking_confirmed: 'Booking Confirmed',
        booking_cancelled: 'Booking Cancelled',
        system: 'System Notification',
        promotional: 'Promotional Offer'
      };

      const notification = await Notification.create({
        userId,
        type,
        title: titleMap[type] || 'Notification',
        message,
        metadata,
        read: false
      });

      return notification;
    } catch (error) {
      logger.error('Error creating notification:', error);
      throw error;
    }
  }

  static async notifyAdmins(type, message, metadata = null) {
    try {
      const admins = await User.findAll({
        where: { role: 'admin', status: 'active' }
      });

      const notifications = await Promise.all(
        admins.map(admin =>
          this.createNotification(admin.id, type, message, metadata)
        )
      );

      return notifications;
    } catch (error) {
      logger.error('Error notifying admins:', error);
      throw error;
    }
  }

  static async getUserNotifications(userId, page = 1, limit = 20) {
    try {
      const offset = (page - 1) * limit;
      
      const { count, rows: notifications } = await Notification.findAndCountAll({
        where: { userId },
        order: [['createdAt', 'DESC']],
        limit,
        offset,
        include: [{
          model: User,
          as: 'user',
          attributes: ['id', 'firstName', 'lastName']
        }]
      });

      return {
        notifications,
        total: count,
        page,
        totalPages: Math.ceil(count / limit)
      };
    } catch (error) {
      logger.error('Error getting user notifications:', error);
      throw error;
    }
  }

  static async markAsRead(notificationId, userId) {
    try {
      const notification = await Notification.findOne({
        where: { id: notificationId, userId }
      });

      if (!notification) {
        throw new Error('Notification not found');
      }

      await notification.update({ read: true });
      return notification;
    } catch (error) {
      logger.error('Error marking notification as read:', error);
      throw error;
    }
  }

  static async markAllAsRead(userId) {
    try {
      const result = await Notification.update(
        { read: true },
        { where: { userId, read: false } }
      );

      return result[0]; // Number of affected rows
    } catch (error) {
      logger.error('Error marking all notifications as read:', error);
      throw error;
    }
  }

  static async getUnreadCount(userId) {
    try {
      const count = await Notification.count({
        where: { userId, read: false }
      });

      return count;
    } catch (error) {
      logger.error('Error getting unread count:', error);
      throw error;
    }
  }
}

module.exports = NotificationService;