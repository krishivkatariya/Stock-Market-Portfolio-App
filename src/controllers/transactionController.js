const Transaction = require('../models/Transaction');

// ==========================================
// Get User Transaction History
// ==========================================

const getTransactions = async (req, res) => {
  try {
    const transactions = await Transaction.find({
      user: req.user.id
    }).sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: transactions.length,
      transactions
    });

  } catch (error) {

    console.error(
      'Get transactions error:',
      error
    );

    res.status(500).json({
      success: false,
      message: 'Unable to get transaction history'
    });
  }
};

module.exports = {
  getTransactions
};