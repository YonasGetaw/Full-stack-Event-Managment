const express = require('express');
const router = express.Router();
const adminConfigController = require('../controllers/adminConfigController');
const { authenticateToken } = require('../middleware/authMiddleware');
const { requireAdmin } = require('../middleware/roleMiddleware');

router.get('/pricing-rules', authenticateToken, requireAdmin, adminConfigController.getPricingRules);
router.put('/pricing-rules/:eventType', authenticateToken, requireAdmin, adminConfigController.upsertPricingRule);

router.get('/payment-methods', authenticateToken, requireAdmin, adminConfigController.getPaymentMethodConfigs);
router.put('/payment-methods/:method', authenticateToken, requireAdmin, adminConfigController.upsertPaymentMethodConfig);

module.exports = router;
