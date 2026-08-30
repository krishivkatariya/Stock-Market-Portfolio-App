const Watchlist = require('../models/Watchlist');
const {
  getStockQuote
} = require('../services/stockService');


// ==========================================
// Get Watchlist
// ==========================================

const getWatchlist = async (req, res) => {
  try {

    let watchlist = await Watchlist.findOne({
      user: req.user.id
    });

    if (!watchlist) {
      watchlist = await Watchlist.create({
        user: req.user.id,
        stocks: []
      });
    }

    const stocks = [];

    for (const stock of watchlist.stocks) {

      try {

        const quote =
          await getStockQuote(stock.symbol);

        stocks.push({
          symbol: stock.symbol,
          companyName: stock.companyName,
          currentPrice:
            quote.regularMarketPrice || null,
          change:
            quote.regularMarketChange || null,
          percentChange:
            quote.regularMarketChangePercent || null
        });

      } catch (error) {

        stocks.push({
          symbol: stock.symbol,
          companyName: stock.companyName,
          currentPrice: null,
          change: null,
          percentChange: null
        });

      }
    }

    res.status(200).json({
      success: true,
      count: stocks.length,
      watchlist: stocks
    });

  } catch (error) {

    console.error(
      'Get watchlist error:',
      error
    );

    res.status(500).json({
      success: false,
      message: 'Unable to get watchlist'
    });
  }
};


// ==========================================
// Add Stock To Watchlist
// ==========================================

const addToWatchlist = async (req, res) => {
  try {

    const { symbol } = req.body;

    if (!symbol) {
      return res.status(400).json({
        success: false,
        message: 'Please provide stock symbol'
      });
    }

    const stockSymbol =
      symbol.toUpperCase().trim();

    // Get stock information
    const quote =
      await getStockQuote(stockSymbol);

    const companyName =
      quote.shortName ||
      quote.longName ||
      stockSymbol;

    // Find watchlist
    let watchlist =
      await Watchlist.findOne({
        user: req.user.id
      });

    // Create if doesn't exist
    if (!watchlist) {

      watchlist = await Watchlist.create({
        user: req.user.id,
        stocks: []
      });
    }

    // Check duplicate
    const alreadyExists =
      watchlist.stocks.some(
        stock =>
          stock.symbol === stockSymbol
      );

    if (alreadyExists) {
      return res.status(400).json({
        success: false,
        message: 'Stock already exists in watchlist'
      });
    }

    // Add stock
    watchlist.stocks.push({
      symbol: stockSymbol,
      companyName
    });

    await watchlist.save();

    res.status(201).json({
      success: true,
      message: 'Stock added to watchlist',
      stock: {
        symbol: stockSymbol,
        companyName
      }
    });

  } catch (error) {

    console.error(
      'Add watchlist error:',
      error
    );

    res.status(500).json({
      success: false,
      message: 'Unable to add stock to watchlist'
    });
  }
};


// ==========================================
// Remove Stock From Watchlist
// ==========================================

const removeFromWatchlist = async (req, res) => {
  try {

    const { symbol } = req.params;

    if (!symbol) {
      return res.status(400).json({
        success: false,
        message: 'Stock symbol is required'
      });
    }

    const stockSymbol =
      symbol.toUpperCase();

    const watchlist =
      await Watchlist.findOne({
        user: req.user.id
      });

    if (!watchlist) {
      return res.status(404).json({
        success: false,
        message: 'Watchlist not found'
      });
    }

    const stockExists =
      watchlist.stocks.some(
        stock =>
          stock.symbol === stockSymbol
      );

    if (!stockExists) {
      return res.status(404).json({
        success: false,
        message: 'Stock not found in watchlist'
      });
    }

    watchlist.stocks =
      watchlist.stocks.filter(
        stock =>
          stock.symbol !== stockSymbol
      );

    await watchlist.save();

    res.status(200).json({
      success: true,
      message: 'Stock removed from watchlist'
    });

  } catch (error) {

    console.error(
      'Remove watchlist error:',
      error
    );

    res.status(500).json({
      success: false,
      message: 'Unable to remove stock from watchlist'
    });
  }
};


module.exports = {
  getWatchlist,
  addToWatchlist,
  removeFromWatchlist
};