const express = require('express');

const {
  getPortfolio,
  buyStock
} = require('../controllers/portfolioController');

const protect = require('../middleware/authMiddleware');

const router = express.Router();


// Get logged-in user's portfolio
router.get(
  '/',
  protect,
  getPortfolio
);

router.post(
  '/buy',
  protect,
  buyStock
);

module.exports = router;