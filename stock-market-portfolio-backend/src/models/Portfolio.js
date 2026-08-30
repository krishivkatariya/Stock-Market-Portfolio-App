const mongoose = require('mongoose');

const portfolioStockSchema = new mongoose.Schema(
  {
    symbol: {
      type: String,
      required: true,
      uppercase: true
    },

    companyName: {
      type: String,
      required: true
    },

    quantity: {
      type: Number,
      required: true,
      min: 0
    },

    averageBuyPrice: {
      type: Number,
      required: true,
      min: 0
    }
  },
  {
    _id: false
  }
);


const portfolioSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true
    },

    stocks: {
      type: [portfolioStockSchema],
      default: []
    }
  },
  {
    timestamps: true
  }
);


module.exports = mongoose.model(
  'Portfolio',
  portfolioSchema
);