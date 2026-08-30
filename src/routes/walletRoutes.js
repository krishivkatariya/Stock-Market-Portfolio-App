const express = require('express');

const {
  getWallet,
  depositMoney,
  withdrawMoney,
  getWalletTransactions
} = require('../controllers/walletController');

const protect = require('../middleware/authMiddleware');

const router = express.Router();


// Get wallet
router.get(
  '/',
  protect,
  getWallet
);


// Deposit money
router.post(
  '/deposit',
  protect,
  depositMoney
);


// Withdraw money
router.post(
  '/withdraw',
  protect,
  withdrawMoney
);

// Get wallet transaction history
router.get(
  '/transactions',
  protect,
  getWalletTransactions
);


module.exports = router;