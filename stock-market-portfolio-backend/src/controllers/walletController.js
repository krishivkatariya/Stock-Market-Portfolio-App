const Account = require('../models/Account');
const WalletTransaction = require('../models/WalletTransaction');

// ==========================================
// Get Wallet Balance
// ==========================================

const getWallet = async (req, res) => {
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
      wallet: {
        availableCash: account.availableCash,
        investedAmount: account.investedAmount,
        totalPortfolioValue: account.totalPortfolioValue,
        accountMode: account.accountMode
      }
    });

  } catch (error) {

    console.error('Get wallet error:', error);

    res.status(500).json({
      success: false,
      message: 'Unable to get wallet information'
    });
  }
};


// ==========================================
// Deposit Money
// ==========================================

const depositMoney = async (req, res) => {
  try {

    const { amount } = req.body;

    // Check amount
    if (amount === undefined || amount === null) {
      return res.status(400).json({
        success: false,
        message: 'Please provide amount'
      });
    }

    // Validate amount
    if (
      typeof amount !== 'number' ||
      !Number.isFinite(amount) ||
      amount <= 0
    ) {
      return res.status(400).json({
        success: false,
        message: 'Amount must be a positive number'
      });
    }

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

    account.availableCash += amount;

    const balanceAfter = account.availableCash;

    await account.save();

    const walletTransaction =
      await WalletTransaction.create({
        user: req.user.id,
        type: 'DEPOSIT',
        amount,
        balanceBefore,
        balanceAfter,
        description: `Added ₹${amount} to wallet`,
        mode: account.accountMode
      });

    res.status(200).json({
      success: true,
      message: 'Money added successfully',

      deposit: {
        amount,
        balanceBefore,
        balanceAfter
      },

      walletTransactionId:
        walletTransaction._id
    });

  } catch (error) {

    console.error('Deposit money error:', error);

    res.status(500).json({
      success: false,
      message: 'Unable to add money'
    });
  }
};


// ==========================================
// Withdraw Money
// ==========================================

const withdrawMoney = async (req, res) => {
  try {

    const { amount } = req.body;

    // Check amount
    if (amount === undefined || amount === null) {
      return res.status(400).json({
        success: false,
        message: 'Please provide amount'
      });
    }

    // Validate amount
    if (
      typeof amount !== 'number' ||
      !Number.isFinite(amount) ||
      amount <= 0
    ) {
      return res.status(400).json({
        success: false,
        message: 'Amount must be a positive number'
      });
    }

    const account = await Account.findOne({
      user: req.user.id
    });

    if (!account) {
      return res.status(404).json({
        success: false,
        message: 'Trading account not found'
      });
    }

    // Check sufficient balance
    if (amount > account.availableCash) {
      return res.status(400).json({
        success: false,
        message: 'Insufficient wallet balance'
      });
    }

    const balanceBefore = account.availableCash;

    account.availableCash -= amount;

    const balanceAfter = account.availableCash;

    await account.save();

    const walletTransaction =
      await WalletTransaction.create({
        user: req.user.id,
        type: 'WITHDRAWAL',
        amount,
        balanceBefore,
        balanceAfter,
        description: `Withdraw ₹${amount} from wallet`,
        mode: account.accountMode
      });

    res.status(200).json({
      success: true,
      message: 'Money withdrawn successfully',

      withdrawal: {
        amount,
        balanceBefore,
        balanceAfter
      },

      walletTransactionId:
        walletTransaction._id
    });

  } catch (error) {

    console.error('Withdraw money error:', error);

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

    const transactions =
      await WalletTransaction.find({
        user: req.user.id
      }).sort({ createdAt: -1 });

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
      message: 'Unable to get wallet transaction history'
    });
  }
};

// ==========================================
// Export
// ==========================================

module.exports = {
  getWallet,
  depositMoney,
  withdrawMoney,
  getWalletTransactions
};