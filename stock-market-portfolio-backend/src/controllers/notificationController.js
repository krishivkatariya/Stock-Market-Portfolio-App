const Account = require('../models/Account');
const Order = require('../models/Order');
const WalletTransaction = require('../models/WalletTransaction');

const getNotifications = async (req, res) => {
  try {
    const account = await Account.findOne({ user: req.user.id });
    const recentOrders = await Order.find({ user: req.user.id }).sort({ createdAt: -1 }).limit(3);
    const recentWalletTransactions = await WalletTransaction.find({ user: req.user.id }).sort({ createdAt: -1 }).limit(3);

    const notifications = [];

    if (account) {
      notifications.push({
        id: 'wallet-balance',
        type: 'wallet',
        title: 'Wallet status',
        message: `Available cash: ₹${account.availableCash.toFixed(2)}`,
        createdAt: account.updatedAt || new Date()
      });
    }

    recentOrders.forEach((order) => {
      notifications.push({
        id: `order-${order._id}`,
        type: 'order',
        title: `${order.side} order ${order.status}`,
        message: `${order.symbol} • ${order.quantity} shares • ₹${order.totalAmount.toFixed(2)}`,
        createdAt: order.createdAt
      });
    });

    recentWalletTransactions.forEach((transaction) => {
      notifications.push({
        id: `wallet-${transaction._id}`,
        type: 'wallet',
        title: transaction.type,
        message: `${transaction.description || 'Wallet activity'} • ₹${transaction.amount.toFixed(2)}`,
        createdAt: transaction.createdAt
      });
    });

    notifications.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    res.status(200).json({
      success: true,
      count: notifications.length,
      notifications
    });
  } catch (error) {
    console.error('Notification fetch error:', error);
    res.status(500).json({
      success: false,
      message: 'Unable to load notifications'
    });
  }
};

const markNotificationsRead = async (req, res) => {
  try {
    res.status(200).json({
      success: true,
      message: 'All notifications marked as read',
      count: 0
    });
  } catch (error) {
    console.error('Notification mark read error:', error);
    res.status(500).json({
      success: false,
      message: 'Unable to update notifications'
    });
  }
};

module.exports = {
  getNotifications,
  markNotificationsRead
};
