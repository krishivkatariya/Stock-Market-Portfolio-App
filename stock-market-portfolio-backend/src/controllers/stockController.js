const {
  searchStocks,
  getStockQuote,
  getHistoricalData,
  normalizeSymbol
} = require('../services/stockService');

const historicalRanges = {
  '1D': { days: 1, interval: '5m' },
  '1W': { days: 7, interval: '1h' },
  '1M': { days: 30, interval: '1d' },
  '3M': { days: 90, interval: '1d' },
  '6M': { days: 180, interval: '1d' },
  '1Y': { days: 365, interval: '1d' },
  '5Y': { days: 1825, interval: '1wk' }
};

const legacyHistoricalRanges = {
  7: historicalRanges['1W'],
  30: historicalRanges['1M'],
  90: historicalRanges['3M'],
  180: historicalRanges['6M'],
  365: historicalRanges['1Y']
};

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

    const requestedRange = String(req.query.range || '').trim().toUpperCase();
    const outputsize = Number(req.query.outputsize);
    const selectedRange = historicalRanges[requestedRange] || legacyHistoricalRanges[outputsize] || historicalRanges['1M'];

    if (requestedRange && !historicalRanges[requestedRange]) {
      return res.status(400).json({
        success: false,
        message: 'range must be one of: 1D, 1W, 1M, 3M, 6M, 1Y, 5Y'
      });
    }

    const normalizedSymbol = normalizeSymbol(symbol);
    const period2 = new Date();
    const period1 = new Date();

    period1.setDate(period1.getDate() - selectedRange.days);

    const data = await getHistoricalData(
      normalizedSymbol,
      Math.floor(period1.getTime() / 1000),
      Math.floor(period2.getTime() / 1000),
      selectedRange.interval
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