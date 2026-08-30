const express = require('express');

const {
  getNotifications,
  markNotificationsRead
} = require('../controllers/notificationController');
const protect = require('../middleware/authMiddleware');

const router = express.Router();

router.get('/', protect, getNotifications);
router.patch('/read-all', protect, markNotificationsRead);

module.exports = router;
