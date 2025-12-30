const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const galleryController = require('../controllers/galleryController');
const { authenticateToken, optionalAuth } = require('../middleware/authMiddleware');
const { requireAdmin } = require('../middleware/roleMiddleware');
const config = require('../config/env');

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(__dirname, '../uploads/gallery');
    require('fs').mkdirSync(uploadPath, { recursive: true });
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: config.upload.maxFileSize
  },
  fileFilter: (req, file, cb) => {
    if (config.upload.allowedFileTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type'), false);
    }
  }
});

// Public routes
router.get('/', optionalAuth, galleryController.getAllGalleryItems);
router.get('/:id', optionalAuth, galleryController.getGalleryItem);

// Authenticated user reactions
router.post('/:id/reaction', authenticateToken, galleryController.setGalleryReaction);

// Admin only routes
router.post('/', authenticateToken, requireAdmin, upload.single('image'), galleryController.createGalleryItem);
router.put('/:id', authenticateToken, requireAdmin, galleryController.updateGalleryItem);
router.delete('/:id', authenticateToken, requireAdmin, galleryController.deleteGalleryItem);

module.exports = router;