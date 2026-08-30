const Order = require('../models/Order');

// ==========================================
// Get User Orders
// ==========================================

const getOrders = async (req, res) => {
  try {

    const orders = await Order.find({
      user: req.user.id
    }).sort({
      createdAt: -1
    });

    res.status(200).json({
      success: true,
      count: orders.length,
      orders
    });

  } catch (error) {

    console.error(
      'Get orders error:',
      error
    );

    res.status(500).json({
      success: false,
      message: 'Unable to get orders'
    });
  }
};

module.exports = {
  getOrders
};