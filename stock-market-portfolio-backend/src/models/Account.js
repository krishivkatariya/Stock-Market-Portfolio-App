const mongoose = require('mongoose');

const accountSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true
    },

    availableCash: {
      type: Number,
      default: 1000000,
      min: 0
    },

    investedAmount: {
      type: Number,
      default: 0,
      min: 0
    },

    totalPortfolioValue: {
      type: Number,
      default: 0,
      min: 0
    },

    accountMode: {
      type: String,
      enum: ['SIMULATION', 'LIVE'],
      default: 'SIMULATION'
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('Account', accountSchema);