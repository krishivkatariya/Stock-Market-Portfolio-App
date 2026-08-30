const Account = require('../models/Account');
const WalletTransaction = require('../models/WalletTransaction');
const Portfolio = require('../models/Portfolio');

const {
  getStockQuote
} = require('../services/stockService');

// Get logged-in user's account
const getAccount = async (req, res) => {
  try {
    const account = await Account.findOne({
      user: req.user.id
    });

    if (!account) {
      return res.status(404).json({
        success: false,
        message: 'Trading account not found'
      });
    }

    res.status(200).json({
      success: true,
      account
    });

  } catch (error) {
    console.error('Get account error:', error);

    res.status(500).json({
      success: false,
      message: 'Unable to get account'
    });
  }
};

// Deposit money into account
const depositMoney = async (req, res) => {
  try {
    const { amount } = req.body;

    // Validate amount
    if (!amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid deposit amount'
      });
    }

    // Find account
    const account = await Account.findOne({
      user: req.user.id
    });

    if (!account) {
      return res.status(404).json({
        success: false,
        message: 'Trading account not found'
      });
    }

    const balanceBefore = account.availableCash;

    const balanceAfter = balanceBefore + Number(amount);

    // Update account balance
    account.availableCash = balanceAfter;

    await account.save();

    // Record wallet transaction
    await WalletTransaction.create({
      user: req.user.id,
      type: 'DEPOSIT',
      amount: Number(amount),
      balanceBefore,
      balanceAfter,
      description: 'Virtual funds deposited',
      mode: account.accountMode
    });

    res.status(200).json({
      success: true,
      message: 'Deposit successful',
      amount: Number(amount),
      balanceBefore,
      balanceAfter
    });

  } catch (error) {
    console.error('Deposit error:', error);

    res.status(500).json({
      success: false,
      message: 'Unable to deposit money'
    });
  }
};

// Withdraw money from account
const withdrawMoney = async (req, res) => {
  try {
    const { amount } = req.body;

    // Validate amount
    if (!amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid withdrawal amount'
      });
    }

    // Find account
    const account = await Account.findOne({
      user: req.user.id
    });

    if (!account) {
      return res.status(404).json({
        success: false,
        message: 'Trading account not found'
      });
    }

    // Check available balance
    if (Number(amount) > account.availableCash) {
      return res.status(400).json({
        success: false,
        message: 'Insufficient available balance'
      });
    }

    const balanceBefore = account.availableCash;

    const balanceAfter = balanceBefore - Number(amount);

    // Update account balance
    account.availableCash = balanceAfter;

    await account.save();

    // Record wallet transaction
    await WalletTransaction.create({
      user: req.user.id,
      type: 'WITHDRAWAL',
      amount: Number(amount),
      balanceBefore,
      balanceAfter,
      description: 'Virtual funds withdrawn',
      mode: account.accountMode
    });

    res.status(200).json({
      success: true,
      message: 'Withdrawal successful',
      amount: Number(amount),
      balanceBefore,
      balanceAfter
    });

  } catch (error) {
    console.error('Withdrawal error:', error);

    res.status(500).json({
      success: false,
      message: 'Unable to withdraw money'
    });
  }
};

// ==========================================
// Get Wallet Transaction History
// ==========================================

const getWalletTransactions = async (req, res) => {
  try {

    const transactions = await WalletTransaction.find({
      user: req.user.id
    })
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: transactions.length,
      transactions
    });

  } catch (error) {

    console.error(
      'Get wallet transactions error:',
      error
    );

    res.status(500).json({
      success: false,
      message: 'Unable to get wallet transactions'
    });
  }
};

// ==========================================
// Get Account Summary
// ==========================================

const getAccountSummary = async (req, res) => {
  try {

    // Find account
    const account = await Account.findOne({
      user: req.user.id
    });

    if (!account) {
      return res.status(404).json({
        success: false,
        message: 'Trading account not found'
      });
    }


    // Find portfolio
    const portfolio = await Portfolio.findOne({
      user: req.user.id
    });


    let totalInvestment = 0;
    let totalPortfolioValue = 0;


    // Calculate portfolio value
    if (portfolio) {

      for (const stock of portfolio.stocks) {

        const investment =
          stock.quantity *
          stock.averageBuyPrice;

        totalInvestment += investment;


        try {

          const quote =
            await getStockQuote(stock.symbol);

          const currentPrice =
            quote.regularMarketPrice || 0;

          const currentValue =
            stock.quantity *
            currentPrice;

          totalPortfolioValue +=
            currentValue;

        } catch (error) {

          console.error(
            `Unable to get price for ${stock.symbol}:`,
            error.message
          );
        }
      }
    }


    // Calculate profit/loss
    const totalProfitLoss =
      totalPortfolioValue -
      totalInvestment;


    // Total account value
    const totalAccountValue =
      account.availableCash +
      totalPortfolioValue;


    res.status(200).json({

      success: true,

      summary: {

        availableCash:
          account.availableCash,

        investedAmount:
          totalInvestment,

        totalPortfolioValue,

        totalProfitLoss,

        totalAccountValue,

        accountMode:
          account.accountMode
      }
    });


  } catch (error) {

    console.error(
      'Get account summary error:',
      error
    );

    res.status(500).json({
      success: false,
      message:
        'Unable to get account summary'
    });
  }
};

module.exports = {
  getAccount,
  depositMoney,
  withdrawMoney,
  getWalletTransactions,
  getAccountSummary
};