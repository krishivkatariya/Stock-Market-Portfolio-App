require('dotenv').config();

const express = require('express');
const cors = require('cors');

const connectDB = require('./config/db');

const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const stockRoutes = require('./routes/stockRoutes');
const portfolioRoutes = require('./routes/portfolioRoutes');
const accountRoutes = require('./routes/accountRoutes');
const walletRoutes = require('./routes/walletRoutes');
const transactionRoutes =
  require('./routes/transactionRoutes');
const watchlistRoutes =
  require('./routes/watchlistRoutes');
const orderRoutes = require('./routes/orderRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const marketRoutes = require('./routes/marketRoutes');
const marketDataService = require('./services/marketDataService');

const app = express();

// Connect MongoDB
connectDB();

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/stocks', stockRoutes);

app.use(
  '/api/portfolio',
  portfolioRoutes
);

app.use('/api/account', accountRoutes);

app.use('/api/wallet', walletRoutes);
app.use(
  '/api/transactions',
  transactionRoutes
);
app.use(
  '/api/watchlist',
  watchlistRoutes
);
app.use(
  '/api/orders',
  orderRoutes
);
app.use(
  '/api/dashboard',
  dashboardRoutes
);
app.use(
  '/api/notifications',
  notificationRoutes
);

// Real-time market stream (SSE) + snapshot
app.use('/api/market', marketRoutes);

// Test route
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Stock Market Portfolio API is running'
  });
});

const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);

  // Start the ONE shared market-data loop (guarded against duplicate timers).
  marketDataService.start();
});

// SSE-friendly server timeouts: keep long-lived event-stream connections open.
server.keepAliveTimeout = 0;
server.headersTimeout = 0;
server.requestTimeout = 0;

// Clean shutdown: stop the shared loop / timers and disconnect clients.
const shutdown = () => {
  marketDataService.stop();
  server.close(() => process.exit(0));
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);