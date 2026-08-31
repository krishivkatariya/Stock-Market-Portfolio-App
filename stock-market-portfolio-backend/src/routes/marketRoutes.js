// ==========================================================
// marketRoutes.js
//
// Real-time market data endpoints for frontend clients.
//
//   GET /api/market/snapshot  -> current shared backend snapshot (REST)
//   GET /api/market/stream    -> Server-Sent Events (SSE) real-time feed
//
// Public by design: consistent with the existing /api/stocks quote endpoint
// (market index data is not user-private and requires no auth today).
// ==========================================================

const express = require('express');
const marketDataService = require('../services/marketDataService');

const router = express.Router();

// Current shared snapshot (initial load / debugging / verification).
router.get('/snapshot', (req, res) => {
  res.status(200).json({
    success: true,
    ...marketDataService.getSnapshot()
  });
});

// Server-Sent Events stream.
router.get('/stream', (req, res) => {
  try {
    req.socket.setTimeout(0);
    req.socket.setKeepAlive(true);
  } catch {
    // socket may already be gone; SSE headers below will fail naturally
  }

  res.setTimeout(0);
  res.status(200);
  res.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive'
  });
  res.flushHeaders();

  marketDataService.addClient(res);

  // Send the current cached snapshot immediately so the client has data
  // right away, before the next backend poll broadcast.
  const initial = marketDataService.getSnapshot();
  res.write(
    `event: market\ndata: ${JSON.stringify({ ...initial, status: 'connected', initial: true })}\n\n`
  );

  req.on('close', () => {
    marketDataService.removeClient(res);
    if (!res.writableEnded) {
      res.end();
    }
  });

  req.on('error', () => {
    marketDataService.removeClient(res);
  });
});

module.exports = router;