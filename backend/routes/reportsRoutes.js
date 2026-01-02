const express = require('express');
const router = express.Router();
const reportsController = require('../controllers/reportsController');
const { authenticateToken } = require('../middleware/authMiddleware');
const { requireAdmin } = require('../middleware/roleMiddleware');

router.get('/event-stats', authenticateToken, requireAdmin, reportsController.getEventStats);
router.get('/admin/dashboard/metrics', authenticateToken, requireAdmin, reportsController.getAdminDashboardMetrics);
router.get('/admin/reports/bookings-over-time', authenticateToken, requireAdmin, reportsController.getAdminBookingsOverTime);
router.get('/admin/reports/revenue-over-time', authenticateToken, requireAdmin, reportsController.getAdminRevenueOverTime);
router.get('/admin/reports/service-distribution', authenticateToken, requireAdmin, reportsController.getAdminServiceDistribution);
router.get('/admin/reports/user-growth', authenticateToken, requireAdmin, reportsController.getAdminUserGrowthOverTime);
router.get('/admin/reports/traffic-source', authenticateToken, requireAdmin, reportsController.getAdminTrafficSource);

module.exports = router;
