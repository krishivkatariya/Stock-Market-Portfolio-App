const express = require('express');

const {
  getTransactions
} = require('../controllers/transactionController');

const protect = require('../middleware/authMiddleware');

const router = express.Router();

// Get logged-in user's transaction history
router.get(
  '/',
  protect,
  getTransactions
);

module.exports = router;