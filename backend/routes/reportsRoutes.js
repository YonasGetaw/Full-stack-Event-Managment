const express = require('express');
const router = express.Router();
const reportsController = require('../controllers/reportsController');
const { authenticateToken } = require('../middleware/authMiddleware');
const { requireAdmin } = require('../middleware/roleMiddleware');

router.get('/event-stats', authenticateToken, requireAdmin, reportsController.getEventStats);

module.exports = router;
