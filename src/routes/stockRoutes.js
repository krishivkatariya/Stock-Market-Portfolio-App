const express = require('express');

const {
  searchStocksController,
  getStockQuoteController,
  getHistoricalStockData
} = require('../controllers/stockController');

const router = express.Router();


// Search stocks
router.get('/search', searchStocksController);


// Historical stock data
router.get('/:symbol/history', getHistoricalStockData);


// Current stock information
router.get('/:symbol', getStockQuoteController);


module.exports = router;