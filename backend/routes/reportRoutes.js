const express = require('express');
const router = express.Router();
const reportController = require('../controllers/reportController');
const reportsController = require('../controllers/reportsController');
const { authenticateToken } = require('../middleware/authMiddleware');
const { requireAdmin } = require('../middleware/roleMiddleware');

// Admin only routes
router.get('/admin/dashboard/metrics', authenticateToken, requireAdmin, reportController.getDashboardMetrics);
router.get('/admin/reports/bookings-over-time', authenticateToken, requireAdmin, reportController.getBookingsOverTime);
router.get('/admin/reports/revenue-over-time', authenticateToken, requireAdmin, reportController.getRevenueOverTime);
router.get('/admin/reports/service-distribution', authenticateToken, requireAdmin, reportController.getServiceDistribution);
router.get('/admin/reports/user-growth', authenticateToken, requireAdmin, reportController.getUserGrowthOverTime);
router.get('/admin/reports/traffic-source', authenticateToken, requireAdmin, reportController.getTrafficSource);

module.exports = router;