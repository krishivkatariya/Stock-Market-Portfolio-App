const Account = require('../models/Account');
const WalletTransaction = require('../models/WalletTransaction');

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

module.exports = {
  getAccount,
  depositMoney,
  withdrawMoney
};