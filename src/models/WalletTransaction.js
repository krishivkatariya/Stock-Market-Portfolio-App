const mongoose = require('mongoose');

const walletTransactionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },

    type: {
      type: String,
      enum: [
        'INITIAL_DEPOSIT',
        'DEPOSIT',
        'WITHDRAWAL',
        'BUY',
        'SELL'
      ],
      required: true
    },

    amount: {
      type: Number,
      required: true,
      min: 0
    },

    balanceBefore: {
      type: Number,
      required: true
    },

    balanceAfter: {
      type: Number,
      required: true
    },

    description: {
      type: String,
      default: ''
    },

    mode: {
      type: String,
      enum: ['SIMULATION', 'LIVE'],
      default: 'SIMULATION'
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model(
  'WalletTransaction',
  walletTransactionSchema
);