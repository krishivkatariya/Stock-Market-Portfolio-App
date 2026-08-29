const express = require('express');

const router = express.Router();

const {
  getAccount,
  depositMoney,
  withdrawMoney
} = require('../controllers/accountController');

const protect = require('../middleware/authMiddleware');

// Get account
router.get('/', protect, getAccount);

// Deposit virtual funds
router.post('/deposit', protect, depositMoney);

// Withdraw virtual funds
router.post('/withdraw', protect, withdrawMoney);

module.exports = router;