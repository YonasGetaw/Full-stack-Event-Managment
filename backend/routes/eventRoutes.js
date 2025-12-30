const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const eventController = require('../controllers/eventController');
const { authenticateToken, optionalAuth } = require('../middleware/authMiddleware');
const { requireAdmin } = require('../middleware/roleMiddleware');
const config = require('../config/env');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(__dirname, '../uploads/events');
    require('fs').mkdirSync(uploadPath, { recursive: true });
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, 'event-' + uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({
  storage,
  limits: { fileSize: config.upload.maxFileSize },
  fileFilter: (req, file, cb) => {
    if (config.upload.allowedFileTypes.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Invalid file type'), false);
  },
});

// Public routes (optional auth so we can reuse same handler in admin too)
router.get('/', optionalAuth, eventController.getAllEvents);
router.get('/:id', optionalAuth, eventController.getEvent);

// User ticket purchase/payment init
router.post('/:id/proceed-payment', authenticateToken, eventController.proceedPayment);

// Admin routes
router.post('/', authenticateToken, requireAdmin, upload.single('image'), eventController.createEvent);
router.put('/:id', authenticateToken, requireAdmin, upload.single('image'), eventController.updateEvent);
router.delete('/:id', authenticateToken, requireAdmin, eventController.deleteEvent);

module.exports = router;
