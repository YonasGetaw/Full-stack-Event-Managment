const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const { authenticateToken } = require('../middleware/authMiddleware');
const { requireAdmin } = require('../middleware/roleMiddleware');
const { paymentProofUpload } = require('../middleware/uploadMiddleware');

// Protected routes (authenticated users)
router.get('/my-event-tickets', authenticateToken, paymentController.getMyEventTickets);
router.get('/user', authenticateToken, paymentController.getUserPayments);
router.get('/event', authenticateToken, requireAdmin, paymentController.getEventPayments);
router.post('/:id/proof', authenticateToken, paymentProofUpload.single('proof'), paymentController.uploadProof);
router.post('/:id/process', authenticateToken, requireAdmin, paymentController.processPayment);

// Admin only routes
router.get('/admin/payments', authenticateToken, requireAdmin, paymentController.getAllPayments);
router.get('/admin/event-payments', authenticateToken, requireAdmin, paymentController.getEventPayments);

// Generic routes (keep LAST so it doesn't catch more specific endpoints)
router.get('/:id', authenticateToken, paymentController.getPayment);

// Webhook route (no auth required for payment providers)
router.post('/webhook', paymentController.handleWebhook);

module.exports = router;