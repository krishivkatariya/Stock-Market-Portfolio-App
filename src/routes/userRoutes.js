const express = require('express');

const {
  getProfile,
  updateProfile,
  changePassword
} = require('../controllers/userController');

const protect = require('../middleware/authMiddleware');

const router = express.Router();

router.get('/me', protect, getProfile);
router.put('/me', protect, updateProfile);
router.get('/profile', protect, getProfile);
router.put('/profile', protect, updateProfile);
router.put('/change-password', protect, changePassword);

module.exports = router;