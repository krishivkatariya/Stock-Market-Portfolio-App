const Portfolio = require('../models/Portfolio');
const Transaction = require('../models/Transaction');
const Account = require('../models/Account');
const WalletTransaction = require('../models/WalletTransaction');
const Order = require('../models/Order');

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

        const quote =
          await getStockQuote(stock.symbol);

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
          averageBuyPrice:
            stock.averageBuyPrice,
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
          averageBuyPrice:
            stock.averageBuyPrice,

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


    // Update account portfolio values

    const account =
      await Account.findOne({
        user: req.user.id
      });

    if (account) {

      account.investedAmount =
        totalInvestment;

      account.totalPortfolioValue =
        totalPortfolioValue;

      await account.save();
    }


    res.status(200).json({

      success: true,

      portfolio: {

        stocks:
          stocksWithPrices,

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
      message:
        'Unable to get portfolio'
    });
  }
};


// ==========================================
// Buy Stock
// ==========================================

const buyStock = async (req, res) => {

  try {

    const {
      symbol,
      quantity
    } = req.body;


    // ==========================================
    // 1. Validate input
    // ==========================================

    if (
      !symbol ||
      quantity === undefined
    ) {

      return res.status(400).json({
        success: false,
        message:
          'Please provide stock symbol and quantity'
      });
    }


    const buyQuantity =
      Number(quantity);


    if (
      !Number.isInteger(buyQuantity) ||
      buyQuantity <= 0
    ) {

      return res.status(400).json({
        success: false,
        message:
          'Quantity must be a positive integer'
      });
    }


    // ==========================================
    // 2. Get current stock information
    // ==========================================

    const quote =
      await getStockQuote(symbol);


    const currentPrice =
      quote.regularMarketPrice;


    if (
      !currentPrice ||
      !Number.isFinite(currentPrice) ||
      currentPrice <= 0
    ) {

      return res.status(400).json({
        success: false,
        message:
          'Unable to get current stock price'
      });
    }


    const stockSymbol =
      quote.symbol ||
      symbol.toUpperCase();


    const companyName =
      quote.shortName ||
      quote.longName ||
      stockSymbol;


    // ==========================================
    // 3. Calculate total purchase amount
    // ==========================================

    const totalAmount =
      buyQuantity *
      currentPrice;


    // ==========================================
    // 4. Find trading account
    // ==========================================

    const account =
      await Account.findOne({
        user: req.user.id
      });


    if (!account) {

      return res.status(404).json({
        success: false,
        message:
          'Trading account not found'
      });
    }


    // ==========================================
    // 5. Check wallet balance
    // ==========================================

    if (
      totalAmount >
      account.availableCash
    ) {

      return res.status(400).json({

        success: false,

        message:
          'Insufficient wallet balance',

        availableCash:
          account.availableCash,

        requiredAmount:
          totalAmount
      });
    }


    // ==========================================
    // 6. Save wallet balance before purchase
    // ==========================================

    const balanceBefore =
      account.availableCash;


    // Deduct money

    account.availableCash -=
      totalAmount;


    const balanceAfter =
      account.availableCash;


    // ==========================================
    // 7. Find/Create portfolio
    // ==========================================

    let portfolio =
      await Portfolio.findOne({
        user: req.user.id
      });


    if (!portfolio) {

      portfolio =
        await Portfolio.create({
          user: req.user.id,
          stocks: []
        });
    }


    // ==========================================
    // 8. Find existing stock
    // ==========================================

    const existingStock =
      portfolio.stocks.find(
        stock =>
          stock.symbol ===
          stockSymbol
      );


    if (existingStock) {

      const oldQuantity =
        existingStock.quantity;


      const oldInvestment =
        oldQuantity *
        existingStock.averageBuyPrice;


      const newInvestment =
        buyQuantity *
        currentPrice;


      const newQuantity =
        oldQuantity +
        buyQuantity;


      const newAveragePrice =
        (
          oldInvestment +
          newInvestment
        ) /
        newQuantity;


      existingStock.quantity =
        newQuantity;


      existingStock.averageBuyPrice =
        newAveragePrice;

    } else {

      portfolio.stocks.push({

        symbol:
          stockSymbol,

        companyName,

        quantity:
          buyQuantity,

        averageBuyPrice:
          currentPrice
      });
    }


    // ==========================================
    // 9. Update account
    // ==========================================

    account.investedAmount +=
      totalAmount;


    await account.save();


    // ==========================================
    // 10. Save portfolio
    // ==========================================

    await portfolio.save();


    // ==========================================
    // 11. Create BUY Order
    // ==========================================

    const order =
      await Order.create({

        user:
          req.user.id,

        symbol:
          stockSymbol,

        companyName,

        orderType:
          'MARKET',

        side:
          'BUY',

        quantity:
          buyQuantity,

        price:
          currentPrice,

        totalAmount,

        status:
          'COMPLETED',

        mode:
          account.accountMode
      });


    // ==========================================
    // 12. Create stock transaction
    // ==========================================

    const transaction =
      await Transaction.create({

        user:
          req.user.id,

        symbol:
          stockSymbol,

        companyName,

        type:
          'BUY',

        quantity:
          buyQuantity,

        price:
          currentPrice,

        totalAmount
      });


    // ==========================================
    // 13. Create wallet transaction
    // ==========================================

    const walletTransaction =
      await WalletTransaction.create({

        user:
          req.user.id,

        type:
          'BUY',

        amount:
          totalAmount,

        balanceBefore,

        balanceAfter,

        description:
          `Buy ${buyQuantity} share(s) of ${stockSymbol}`,

        mode:
          account.accountMode
      });


    // ==========================================
    // 14. Send response
    // ==========================================

    res.status(201).json({

      success: true,

      message:
        'Stock purchased successfully',


      // Order information

      order: {

        id:
          order._id,

        symbol:
          stockSymbol,

        companyName,

        side:
          'BUY',

        orderType:
          'MARKET',

        quantity:
          buyQuantity,

        price:
          currentPrice,

        totalAmount,

        status:
          'COMPLETED'
      },


      // Purchase information

      purchase: {

        symbol:
          stockSymbol,

        companyName,

        quantity:
          buyQuantity,

        price:
          currentPrice,

        totalAmount
      },


      // Account information

      account: {

        availableCash:
          account.availableCash,

        investedAmount:
          account.investedAmount
      },


      transactionId:
        transaction._id,


      walletTransactionId:
        walletTransaction._id,


      orderId:
        order._id
    });


  } catch (error) {

    console.error(
      '========== BUY STOCK ERROR =========='
    );

    console.error(error);

    console.error(
      '======================================'
    );


    res.status(500).json({

      success: false,

      message:
        'Unable to buy stock',

      error:
        error.message
    });
  }
};


// ==========================================
// Sell Stock
// ==========================================

const sellStock = async (req, res) => {

  try {

    const {
      symbol,
      quantity
    } = req.body;


    // ==========================================
    // 1. Validate input
    // ==========================================

    if (
      !symbol ||
      quantity === undefined
    ) {

      return res.status(400).json({
        success: false,
        message:
          'Please provide stock symbol and quantity'
      });
    }


    const sellQuantity =
      Number(quantity);


    if (
      !Number.isInteger(sellQuantity) ||
      sellQuantity <= 0
    ) {

      return res.status(400).json({
        success: false,
        message:
          'Quantity must be a positive integer'
      });
    }


    // ==========================================
    // 2. Get current stock information
    // ==========================================

    const quote =
      await getStockQuote(symbol);


    const currentPrice =
      quote.regularMarketPrice;


    if (
      !currentPrice ||
      !Number.isFinite(currentPrice) ||
      currentPrice <= 0
    ) {

      return res.status(400).json({
        success: false,
        message:
          'Unable to get current stock price'
      });
    }


    const stockSymbol =
      quote.symbol ||
      symbol.toUpperCase();


    const companyName =
      quote.shortName ||
      quote.longName ||
      stockSymbol;


    // ==========================================
    // 3. Find portfolio
    // ==========================================

    const portfolio =
      await Portfolio.findOne({
        user: req.user.id
      });


    if (!portfolio) {

      return res.status(404).json({
        success: false,
        message:
          'Portfolio not found'
      });
    }


    // ==========================================
    // 4. Find stock
    // ==========================================

    const existingStock =
      portfolio.stocks.find(
        stock =>
          stock.symbol ===
          stockSymbol
      );


    // ==========================================
    // 5. Check ownership
    // ==========================================

    if (!existingStock) {

      return res.status(400).json({
        success: false,
        message:
          'You do not own this stock'
      });
    }


    // ==========================================
    // 6. Check quantity
    // ==========================================

    if (
      sellQuantity >
      existingStock.quantity
    ) {

      return res.status(400).json({

        success: false,

        message:
          'Insufficient stock quantity',

        ownedQuantity:
          existingStock.quantity,

        requestedQuantity:
          sellQuantity
      });
    }


    // ==========================================
    // 7. Calculate selling amount
    // ==========================================

    const totalAmount =
      sellQuantity *
      currentPrice;


    // ==========================================
    // 8. Find account
    // ==========================================

    const account =
      await Account.findOne({
        user: req.user.id
      });


    if (!account) {

      return res.status(404).json({
        success: false,
        message:
          'Trading account not found'
      });
    }


    // ==========================================
    // 9. Balance before SELL
    // ==========================================

    const balanceBefore =
      account.availableCash;


    // Add money back

    account.availableCash +=
      totalAmount;


    const balanceAfter =
      account.availableCash;


    // ==========================================
    // 10. Update portfolio
    // ==========================================

    existingStock.quantity -=
      sellQuantity;


    if (
      existingStock.quantity === 0
    ) {

      portfolio.stocks =
        portfolio.stocks.filter(
          stock =>
            stock.symbol !==
            stockSymbol
        );
    }


    // ==========================================
    // 11. Update invested amount
    // ==========================================

    const costBasis =
      sellQuantity *
      existingStock.averageBuyPrice;


    account.investedAmount =
      Math.max(
        0,
        account.investedAmount -
        costBasis
      );


    // ==========================================
    // 12. Save account & portfolio
    // ==========================================

    await account.save();

    await portfolio.save();


    // ==========================================
    // 13. Create SELL Order
    // ==========================================

    const order =
      await Order.create({

        user:
          req.user.id,

        symbol:
          stockSymbol,

        companyName,

        orderType:
          'MARKET',

        side:
          'SELL',

        quantity:
          sellQuantity,

        price:
          currentPrice,

        totalAmount,

        status:
          'COMPLETED',

        mode:
          account.accountMode
      });


    // ==========================================
    // 14. Create stock transaction
    // ==========================================

    const transaction =
      await Transaction.create({

        user:
          req.user.id,

        symbol:
          stockSymbol,

        companyName,

        type:
          'SELL',

        quantity:
          sellQuantity,

        price:
          currentPrice,

        totalAmount
      });


    // ==========================================
    // 15. Create wallet transaction
    // ==========================================

    const walletTransaction =
      await WalletTransaction.create({

        user:
          req.user.id,

        type:
          'SELL',

        amount:
          totalAmount,

        balanceBefore,

        balanceAfter,

        description:
          `Sell ${sellQuantity} share(s) of ${stockSymbol}`,

        mode:
          account.accountMode
      });


    // ==========================================
    // 16. Send response
    // ==========================================

    res.status(200).json({

      success: true,

      message:
        'Stock sold successfully',


      // Order information

      order: {

        id:
          order._id,

        symbol:
          stockSymbol,

        companyName,

        side:
          'SELL',

        orderType:
          'MARKET',

        quantity:
          sellQuantity,

        price:
          currentPrice,

        totalAmount,

        status:
          'COMPLETED'
      },


      // Sale information

      sale: {

        symbol:
          stockSymbol,

        companyName,

        quantity:
          sellQuantity,

        price:
          currentPrice,

        totalAmount
      },


      transactionId:
        transaction._id,


      walletTransactionId:
        walletTransaction._id,


      orderId:
        order._id,


      availableCash:
        account.availableCash
    });


  } catch (error) {

    console.error(
      '========== SELL STOCK ERROR =========='
    );

    console.error(error);

    console.error(
      '======================================'
    );


    res.status(500).json({

      success: false,

      message:
        'Unable to sell stock',

      error:
        error.message
    });
  }
};


// ==========================================
// Get Stock Transaction History
// ==========================================

const getTransactions = async (req, res) => {

  try {

    const transactions =
      await Transaction.find({
        user: req.user.id
      })
      .sort({
        createdAt: -1
      });


    res.status(200).json({

      success: true,

      count:
        transactions.length,

      transactions
    });


  } catch (error) {

    console.error(
      'Get transactions error:',
      error
    );


    res.status(500).json({

      success: false,

      message:
        'Unable to get transaction history'
    });
  }
};


// ==========================================
// Export
// ==========================================

module.exports = {

  getPortfolio,

  buyStock,

  sellStock,

  getTransactions

};