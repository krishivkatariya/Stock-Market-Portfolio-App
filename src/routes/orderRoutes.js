const express = require('express');

const {
  getOrders
} = require('../controllers/orderController');

const protect = require('../middleware/authMiddleware');

const router = express.Router();

// Get logged-in user's orders
router.get(
  '/',
  protect,
  getOrders
);

module.exports = router;