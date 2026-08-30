const express = require('express');

const {
  getPortfolio,
  buyStock,
  sellStock,
  getTransactions
} = require('../controllers/portfolioController');

const protect = require('../middleware/authMiddleware');

const router = express.Router();

// ==========================================
// GET USER PORTFOLIO
// ==========================================

router.get(
  '/',
  protect,
  getPortfolio
);

// Get stock transaction history
router.get(
  '/transactions',
  protect,
  getTransactions
);

// ==========================================
// BUY STOCK
// ==========================================

router.post(
  '/buy',
  protect,
  buyStock
);


// ==========================================
// SELL STOCK
// ==========================================

router.post(
  '/sell',
  protect,
  sellStock
);


module.exports = router;