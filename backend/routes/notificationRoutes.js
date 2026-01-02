const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notificationController');
const { authenticateToken } = require('../middleware/authMiddleware');
const { requireAdmin } = require('../middleware/roleMiddleware');

// Protected routes
router.get('/', authenticateToken, notificationController.getUserNotifications);
router.get('/unread-count', authenticateToken, notificationController.getUnreadCount);
router.patch('/read-all', authenticateToken, notificationController.markAllAsRead);
router.delete('/:id', authenticateToken, notificationController.deleteNotification);

// Admin only routes
router.post('/admin', authenticateToken, requireAdmin, notificationController.createAdminNotification);
router.get('/admin', authenticateToken, requireAdmin, notificationController.getAdminNotifications);
router.get('/admin/unread-count', authenticateToken, requireAdmin, notificationController.getAdminUnreadCount);
router.patch('/admin/:id/read', authenticateToken, requireAdmin, notificationController.markAdminNotificationAsRead);
router.patch('/admin/read-all', authenticateToken, requireAdmin, notificationController.markAllAdminNotificationsAsRead);

module.exports = router;