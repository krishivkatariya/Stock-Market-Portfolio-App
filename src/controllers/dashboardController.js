const Account = require('../models/Account');
const Portfolio = require('../models/Portfolio');
const Order = require('../models/Order');
const WalletTransaction = require('../models/WalletTransaction');
const Transaction = require('../models/Transaction');
const { getStockQuote } = require('../services/stockService');

const getDashboardSummary = async (req, res) => {
  try {
    const account = await Account.findOne({ user: req.user.id });
    const portfolio = await Portfolio.findOne({ user: req.user.id });
    const recentOrders = await Order.find({ user: req.user.id }).sort({ createdAt: -1 }).limit(5);
    const recentTransactions = await Transaction.find({ user: req.user.id }).sort({ createdAt: -1 }).limit(5);
    const walletTransactions = await WalletTransaction.find({ user: req.user.id }).sort({ createdAt: -1 }).limit(5);

    let totalInvested = 0;
    let totalMarketValue = 0;
    let holdingCount = 0;

    if (portfolio && portfolio.stocks?.length) {
      for (const holding of portfolio.stocks) {
        holdingCount += 1;
        totalInvested += holding.quantity * holding.averageBuyPrice;

        try {
          const quote = await getStockQuote(holding.symbol);
          totalMarketValue += (quote.regularMarketPrice || 0) * holding.quantity;
        } catch (error) {
          totalMarketValue += 0;
        }
      }
    }

    const totalProfitLoss = totalMarketValue - totalInvested;
    const availableCash = account ? account.availableCash : 0;
    const totalBalance = availableCash + totalMarketValue;

    res.status(200).json({
      success: true,
      dashboard: {
        account: {
          availableCash,
          totalBalance,
          investedAmount: account ? account.investedAmount : 0,
          totalPortfolioValue: account ? account.totalPortfolioValue : 0
        },
        portfolio: {
          holdingCount,
          totalInvested,
          totalMarketValue,
          totalProfitLoss
        },
        recentOrders,
        recentTransactions,
        walletTransactions
      }
    });
  } catch (error) {
    console.error('Dashboard summary error:', error);
    res.status(500).json({
      success: false,
      message: 'Unable to load dashboard summary'
    });
  }
};

module.exports = {
  getDashboardSummary
};
