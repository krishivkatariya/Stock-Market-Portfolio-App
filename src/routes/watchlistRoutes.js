const express = require('express');

const {
  getWatchlist,
  addToWatchlist,
  removeFromWatchlist
} = require('../controllers/watchlistController');

const protect =
  require('../middleware/authMiddleware');

const router = express.Router();

// Get watchlist
router.get(
  '/',
  protect,
  getWatchlist
);

// Add stock to watchlist
router.post(
  '/',
  protect,
  addToWatchlist
);

// Remove stock from watchlist
router.delete(
  '/:symbol',
  protect,
  removeFromWatchlist
);

module.exports = router;