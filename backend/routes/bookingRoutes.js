const express = require('express');
const router = express.Router();
const bookingController = require('../controllers/bookingController');
const { authenticateToken, optionalAuth } = require('../middleware/authMiddleware');
const { requireAdmin } = require('../middleware/roleMiddleware');

// Public routes
router.post('/calc-price', optionalAuth, bookingController.calculatePrice);

// Protected routes - User
router.post('/', authenticateToken, bookingController.createBooking);
router.get('/my-bookings', authenticateToken, bookingController.getUserBookings);
router.get('/:id', authenticateToken, bookingController.getBooking);
router.get('/:id/qr', authenticateToken, bookingController.getQRCode);
router.post('/:id/proceed-payment', authenticateToken, bookingController.proceedPayment);

// Admin only routes
router.get('/admin/bookings', authenticateToken, requireAdmin, bookingController.getAllBookings);
router.put('/admin/bookings/:id/status', authenticateToken, requireAdmin, bookingController.updateBookingStatus);

module.exports = router;