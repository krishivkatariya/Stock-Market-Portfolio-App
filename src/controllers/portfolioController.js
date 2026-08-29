const Portfolio = require('../models/Portfolio');
const Transaction = require('../models/Transaction');
const {
  getStockQuote
} = require('../services/stockService');


// ==========================================
// Get User Portfolio
// ==========================================

const getPortfolio = async (req, res) => {
  try {

    let portfolio = await Portfolio.findOne({
      user: req.user.id
    });

    // Create portfolio if it doesn't exist
    if (!portfolio) {
      portfolio = await Portfolio.create({
        user: req.user.id,
        stocks: []
      });
    }

    const stocksWithPrices = [];

    for (const stock of portfolio.stocks) {

      try {

        const quote = await getStockQuote(stock.symbol);

        const currentPrice =
          quote.regularMarketPrice || 0;

        const investment =
          stock.quantity *
          stock.averageBuyPrice;

        const currentValue =
          stock.quantity *
          currentPrice;

        const profitLoss =
          currentValue -
          investment;

        stocksWithPrices.push({
          symbol: stock.symbol,
          companyName: stock.companyName,
          quantity: stock.quantity,
          averageBuyPrice: stock.averageBuyPrice,
          currentPrice,
          investment,
          currentValue,
          profitLoss
        });

      } catch (error) {

        stocksWithPrices.push({
          symbol: stock.symbol,
          companyName: stock.companyName,
          quantity: stock.quantity,
          averageBuyPrice: stock.averageBuyPrice,
          currentPrice: null,
          investment:
            stock.quantity *
            stock.averageBuyPrice,
          currentValue: null,
          profitLoss: null
        });

      }
    }


    const totalInvestment =
      stocksWithPrices.reduce(
        (total, stock) =>
          total + stock.investment,
        0
      );


    const totalPortfolioValue =
      stocksWithPrices.reduce(
        (total, stock) =>
          total +
          (stock.currentValue || 0),
        0
      );


    const totalProfitLoss =
      totalPortfolioValue -
      totalInvestment;


    res.status(200).json({
      success: true,

      portfolio: {
        stocks: stocksWithPrices,

        totalInvestment,

        totalPortfolioValue,

        totalProfitLoss
      }
    });

  } catch (error) {

    console.error(
      'Get portfolio error:',
      error
    );

    res.status(500).json({
      success: false,
      message: 'Unable to get portfolio'
    });
  }
};

// ==========================================
// Buy Stock
// ==========================================

const buyStock = async (req, res) => {
  try {

    const { symbol, quantity } = req.body;

    // Check required fields
    if (!symbol || !quantity) {
      return res.status(400).json({
        success: false,
        message: 'Please provide stock symbol and quantity'
      });
    }

    // Validate quantity
    if (
      !Number.isInteger(quantity) ||
      quantity <= 0
    ) {
      return res.status(400).json({
        success: false,
        message: 'Quantity must be a positive integer'
      });
    }

    // Get current stock information
    const quote = await getStockQuote(symbol);

    const currentPrice =
      quote.regularMarketPrice;

    const companyName =
      quote.shortName ||
      quote.longName ||
      symbol.toUpperCase();

    if (!currentPrice) {
      return res.status(400).json({
        success: false,
        message: 'Unable to get current stock price'
      });
    }

    // Find user's portfolio
    let portfolio = await Portfolio.findOne({
      user: req.user.id
    });

    // Create portfolio if it doesn't exist
    if (!portfolio) {
      portfolio = await Portfolio.create({
        user: req.user.id,
        stocks: []
      });
    }

    // Find existing stock
    const existingStock =
      portfolio.stocks.find(
        stock =>
          stock.symbol ===
          quote.symbol
      );

    if (existingStock) {

      // Calculate new quantity
      const oldQuantity =
        existingStock.quantity;

      const oldInvestment =
        oldQuantity *
        existingStock.averageBuyPrice;

      const newInvestment =
        quantity *
        currentPrice;

      const newQuantity =
        oldQuantity +
        quantity;

      // Calculate new average buy price
      const newAveragePrice =
        (oldInvestment + newInvestment) /
        newQuantity;

      existingStock.quantity =
        newQuantity;

      existingStock.averageBuyPrice =
        newAveragePrice;

    } else {

      // Add new stock
      portfolio.stocks.push({
        symbol: quote.symbol,
        companyName,
        quantity,
        averageBuyPrice: currentPrice
      });
    }

    // Save portfolio
    await portfolio.save();

    // Calculate transaction amount
    const totalAmount =
      quantity * currentPrice;

    // Create transaction
    const transaction =
      await Transaction.create({
        user: req.user.id,
        symbol: quote.symbol,
        companyName,
        type: 'BUY',
        quantity,
        price: currentPrice,
        totalAmount
      });

    res.status(201).json({
      success: true,
      message: 'Stock purchased successfully',

      purchase: {
        symbol: quote.symbol,
        companyName,
        quantity,
        price: currentPrice,
        totalAmount
      },

      transactionId: transaction._id
    });

  } catch (error) {

    console.error(
      'Buy stock error:',
      error
    );

    res.status(500).json({
      success: false,
      message: 'Unable to buy stock'
    });
  }
};

module.exports = {
  getPortfolio,
  buyStock
};