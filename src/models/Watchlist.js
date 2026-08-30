const mongoose = require('mongoose');

const watchlistSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true
    },

    stocks: [
      {
        symbol: {
          type: String,
          required: true,
          uppercase: true,
          trim: true
        },

        companyName: {
          type: String,
          required: true
        }
      }
    ]
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model(
  'Watchlist',
  watchlistSchema
);