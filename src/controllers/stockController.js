const {
  searchStocks,
  getStockQuote,
  getHistoricalData,
  normalizeSymbol
} = require('../services/stockService');

const allowedHistoricalOutSizes = [7, 30, 90, 180, 365];

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
      results: data?.quotes || []
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

    const normalizedSymbol = normalizeSymbol(symbol);
    const data = await getStockQuote(normalizedSymbol);

    res.status(200).json({
      success: true,
      stock: {
        symbol: data.symbol,
        companyName: data.shortName || data.longName || normalizedSymbol,
        exchange: data.fullExchangeName || data.exchange,
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

    return res.status(400).json({
      success: false,
      message: error.message || 'Unable to get stock information'
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

    const outputsize = Number(req.query.outputsize || 30);

    if (!Number.isInteger(outputsize) || !allowedHistoricalOutSizes.includes(outputsize)) {
      return res.status(400).json({
        success: false,
        message: 'outputsize must be one of: 7, 30, 90, 180, 365'
      });
    }

    const normalizedSymbol = normalizeSymbol(symbol);
    const period2 = new Date();
    const period1 = new Date();

    period1.setDate(period1.getDate() - outputsize);

    const data = await getHistoricalData(
      normalizedSymbol,
      Math.floor(period1.getTime() / 1000),
      Math.floor(period2.getTime() / 1000),
      '1d'
    );

    res.status(200).json({
      success: true,
      symbol: normalizedSymbol,
      count: data.length,
      history: data
    });

  } catch (error) {
    console.error('Historical data error:', error);

    return res.status(400).json({
      success: false,
      message: error.message || 'Unable to get historical stock data'
    });
  }
};

module.exports = {
  searchStocksController,
  getStockQuoteController,
  getHistoricalStockData
};