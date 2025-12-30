const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { authenticateToken } = require('../middleware/authMiddleware');
const { requireAdmin } = require('../middleware/roleMiddleware');
const { profileUpload } = require('../middleware/uploadMiddleware');

// Protected routes - User profile
router.get('/me', authenticateToken, userController.getMe);
router.put('/me', authenticateToken, userController.updateProfile);

// NEW: Profile image upload routes
router.put('/me/profile-image-upload', 
  authenticateToken, 
  profileUpload.single('profileImage'),
  userController.uploadProfileImage
);

router.delete('/me/profile-image', 
  authenticateToken, 
  userController.removeProfileImage
);

// Admin profile image routes
router.put('/admin/users/:id/profile-image-upload', 
  authenticateToken, 
  requireAdmin,
  profileUpload.single('profileImage'),
  userController.uploadProfileImageAdmin
);

// Admin only routes
router.get('/admin/users', authenticateToken, requireAdmin, userController.getAllUsers);
router.get('/admin/users/:id', authenticateToken, requireAdmin, userController.getUserById);
router.put('/admin/users/:id', authenticateToken, requireAdmin, userController.updateUser);
router.delete('/admin/users/:id', authenticateToken, requireAdmin, userController.deleteUser);

module.exports = router;