const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const serviceController = require('../controllers/serviceController');
const { authenticateToken } = require('../middleware/authMiddleware');
const { requireAdmin } = require('../middleware/roleMiddleware');
const config = require('../config/env');

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(__dirname, '../uploads/services');
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
router.get('/', serviceController.getAllServices);
router.get('/:id', serviceController.getService);

// Admin only routes
router.post('/', authenticateToken, requireAdmin, upload.array('images', 5), serviceController.createService);
router.put('/:id', authenticateToken, requireAdmin, upload.array('images', 5), serviceController.updateService);
router.delete('/:id', authenticateToken, requireAdmin, serviceController.deleteService);
router.delete('/:id/images/:imageIndex', authenticateToken, requireAdmin, serviceController.deleteServiceImage);

module.exports = router;