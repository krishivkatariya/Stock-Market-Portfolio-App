const express = require('express');

const router = express.Router();

const {
  getAccount,
  depositMoney,
  withdrawMoney,
  getWalletTransactions,
  getAccountSummary
} = require('../controllers/accountController');

const protect = require('../middleware/authMiddleware');

// Get account
router.get('/', protect, getAccount);

// Get wallet transaction history
router.get(
  '/transactions',
  protect,
  getWalletTransactions
);

// Get account summary
router.get(
  '/summary',
  protect,
  getAccountSummary
);

// Deposit virtual funds
router.post('/deposit', protect, depositMoney);

// Withdraw virtual funds
router.post('/withdraw', protect, withdrawMoney);

module.exports = router;