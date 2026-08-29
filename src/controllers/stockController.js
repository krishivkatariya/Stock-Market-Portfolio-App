const {
  searchStocks,
  getStockQuote,
  getHistoricalData
} = require('../services/stockService');


// ==========================================
// Search Stocks
// ==========================================

const searchStocksController = async (req, res) => {
  try {
    const { q } = req.query;

    if (!q) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a stock search query'
      });
    }

    const data = await searchStocks(q);

    res.status(200).json({
      success: true,
      results: data.quotes || []
    });

  } catch (error) {
    console.error('Stock search error:', error);

    res.status(500).json({
      success: false,
      message: 'Unable to search stocks'
    });
  }
};


// ==========================================
// Get Current Stock Quote
// ==========================================

const getStockQuoteController = async (req, res) => {
  try {
    const { symbol } = req.params;

    if (!symbol) {
      return res.status(400).json({
        success: false,
        message: 'Stock symbol is required'
      });
    }

    const data = await getStockQuote(symbol);

    res.status(200).json({
      success: true,
      stock: {
        symbol: data.symbol,
        name: data.shortName || data.longName,
        exchange: data.fullExchangeName,
        currency: data.currency,

        currentPrice: data.regularMarketPrice,

        open: data.regularMarketOpen,
        high: data.regularMarketDayHigh,
        low: data.regularMarketDayLow,

        previousClose: data.regularMarketPreviousClose,

        change: data.regularMarketChange,
        percentChange: data.regularMarketChangePercent,

        volume: data.regularMarketVolume,

        marketCap: data.marketCap,

        timestamp: data.regularMarketTime
      }
    });

  } catch (error) {
    console.error('Stock quote error:', error);

    res.status(500).json({
      success: false,
      message: 'Unable to get stock information'
    });
  }
};


// ==========================================
// Historical Stock Data
// ==========================================

const getHistoricalStockData = async (req, res) => {
  try {
    const { symbol } = req.params;

    if (!symbol) {
      return res.status(400).json({
        success: false,
        message: 'Stock symbol is required'
      });
    }

    const outputsize = parseInt(
      req.query.outputsize || '30'
    );

    const period2 = new Date();

    const period1 = new Date();

    period1.setDate(
      period1.getDate() - outputsize
    );

    const data = await getHistoricalData(
      symbol,
      period1,
      period2
    );

    res.status(200).json({
      success: true,
      symbol: symbol.toUpperCase(),
      count: data.length,
      history: data
    });

  } catch (error) {
    console.error('Historical data error:', error);

    res.status(500).json({
      success: false,
      message: 'Unable to get historical stock data'
    });
  }
};


module.exports = {
  searchStocksController,
  getStockQuoteController,
  getHistoricalStockData
};