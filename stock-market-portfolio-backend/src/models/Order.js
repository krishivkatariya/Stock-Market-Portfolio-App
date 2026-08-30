const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },

    symbol: {
      type: String,
      required: true,
      uppercase: true
    },

    companyName: {
      type: String,
      required: true
    },

    orderType: {
      type: String,
      enum: ['MARKET'],
      default: 'MARKET'
    },

    side: {
      type: String,
      enum: ['BUY', 'SELL'],
      required: true
    },

    quantity: {
      type: Number,
      required: true,
      min: 1
    },

    price: {
      type: Number,
      required: true,
      min: 0
    },

    totalAmount: {
      type: Number,
      required: true,
      min: 0
    },

    status: {
      type: String,
      enum: [
        'PENDING',
        'COMPLETED',
        'CANCELLED',
        'REJECTED'
      ],
      default: 'COMPLETED'
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

module.exports = mongoose.model('Order', orderSchema);