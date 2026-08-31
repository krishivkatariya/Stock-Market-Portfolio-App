// ==========================================================
// marketDataService.js
//
// Shared, provider-agnostic backend market-data hub.
//
//  - Maintains the latest market snapshot for subscribed symbols.
//  - Runs ONE shared polling loop that fetches fresh data through the
//    EXISTING stockService.getStockQuote() (which wraps yahoo-finance2).
//    No per-client loops, no invented streaming provider.
//  - Broadcasts normalized updates to every connected SSE client.
//  - Survives provider failures: keeps the last valid quote, never crashes.
//  - Guards against duplicate timers (safe across module re-requires).
// ==========================================================

const { getStockQuote } = require('./stockService');

// Default subscribed market symbols.
const DEFAULT_SYMBOLS = [
  { symbol: '^NSEI', label: 'NIFTY 50' },
  { symbol: '^BSESN', label: 'SENSEX' }
];

// One shared loop for ALL clients. Default 30s (same cadence as the old
// browser-side polling, but now shared server-side). Override via env.
const POLL_INTERVAL_MS = Math.max(
  5000,
  Number(process.env.MARKET_POLL_INTERVAL_MS) || 30000
);

const HEARTBEAT_INTERVAL_MS = 25000;

// Normal NSE/BSE equity session (Asia/Kolkata):
// Monday–Friday 09:15–15:30 IST. No holiday/trading-calendar logic here.
const MARKET_OPEN_MINUTES = 9 * 60 + 15;
const MARKET_CLOSE_MINUTES = 15 * 60 + 30;

// ----------------------------------------------------------
// Market session helper (India timezone)
// ----------------------------------------------------------

const isMarketOpen = () => {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Kolkata',
      weekday: 'short',
      hour: 'numeric',
      minute: 'numeric',
      hour12: false
    }).formatToParts(new Date());

    const weekday = parts.find((p) => p.type === 'weekday')?.value;
    const hour = Number(parts.find((p) => p.type === 'hour')?.value || 0) % 24;
    const minute = Number(parts.find((p) => p.type === 'minute')?.value || 0);

    if (weekday === 'Sat' || weekday === 'Sun') {
      return false;
    }

    const nowMinutes = hour * 60 + minute;
    return nowMinutes >= MARKET_OPEN_MINUTES && nowMinutes < MARKET_CLOSE_MINUTES;
  } catch {
    // If timezone computation fails, be conservative: treat as closed.
    return false;
  }
};
// ----------------------------------------------------------
// Internal state (module singleton)
// ----------------------------------------------------------

const state = {
  started: false,
  pollTimer: null,
  heartbeatTimer: null,
  pollInFlight: false,
  lastPollAt: null,
  lastError: null,
  quotes: new Map(), // symbol -> normalized snapshot
  clients: new Set() // active SSE response objects
};

// Build a placeholder (no price yet) for a subscribed symbol.
const emptyQuote = (symbol, label) => ({
  symbol,
  label,
  price: null,
  change: null,
  percentChange: null,
  timestamp: null,
  marketStatus: isMarketOpen() ? 'open' : 'closed'
});

// Normalize a Yahoo quote into the compact structure we broadcast.
const normalizeQuote = (symbol, label, quote) => {
  if (!quote) {
    throw new Error(`No quote returned for ${symbol}`);
  }

  const price = Number(quote.regularMarketPrice);
  const change = Number(quote.regularMarketChange);
  const percentChange = Number(quote.regularMarketChangePercent);

  if (!Number.isFinite(price)) {
    throw new Error(`No regularMarketPrice for ${symbol}`);
  }

  return {
    symbol,
    label,
    price,
    change: Number.isFinite(change) ? change : null,
    percentChange: Number.isFinite(percentChange) ? percentChange : null,
    timestamp: quote.regularMarketTime || Date.now(),
    marketStatus: isMarketOpen() ? 'open' : 'closed'
  };
};

// Parse optional env override for subscribed symbols.
const resolveSymbols = () => {
  if (process.env.MARKET_SYMBOLS) {
    try {
      const parsed = JSON.parse(process.env.MARKET_SYMBOLS);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map((entry) =>
          typeof entry === 'string'
            ? { symbol: entry.toUpperCase(), label: entry.toUpperCase() }
            : {
                symbol: String(entry.symbol).toUpperCase(),
                label: entry.label || String(entry.symbol).toUpperCase()
              }
        );
      }
    } catch {
      // fall through to defaults
    }
  }
  return DEFAULT_SYMBOLS;
};

// ----------------------------------------------------------
// Broadcast helpers
// ----------------------------------------------------------

const buildPayload = (status) => ({
  status,
  serverTimestamp: Date.now(),
  marketStatus: isMarketOpen() ? 'open' : 'closed',
  quotes: Object.fromEntries(state.quotes)
});

const broadcast = (status) => {
  const payload = buildPayload(status);
  const frame = `event: market\ndata: ${JSON.stringify(payload)}\n\n`;

  for (const client of state.clients) {
    try {
      if (!client.writableEnded && !client.destroyed) {
        client.write(frame);
      } else {
        state.clients.delete(client);
      }
    } catch {
      state.clients.delete(client);
    }
  }
};

const sendHeartbeat = () => {
  for (const client of state.clients) {
    try {
      if (!client.writableEnded && !client.destroyed) {
        client.write(': hb\n\n');
      } else {
        state.clients.delete(client);
      }
    } catch {
      state.clients.delete(client);
    }
  }
};

// ----------------------------------------------------------
// The single shared polling loop
// ----------------------------------------------------------

const poll = async () => {
  // Prevent overlapping cycles if a poll runs longer than the interval.
  if (state.pollInFlight) {
    return;
  }
  state.pollInFlight = true;

  try {
    const symbols = [...state.quotes.keys()];

    const results = await Promise.allSettled(
      symbols.map(async (symbol) => {
        const current = state.quotes.get(symbol);
        const quote = await getStockQuote(symbol);
        return normalizeQuote(symbol, current?.label || symbol, quote);
      })
    );

    let anyUpdated = false;
    let anyFailed = false;

    results.forEach((result) => {
      if (result.status === 'fulfilled') {
        state.quotes.set(result.value.symbol, result.value);
        anyUpdated = true;
      } else {
        anyFailed = true;
        // Keep the previous valid quote for failed symbols.
      }
    });

    state.lastPollAt = Date.now();
    state.lastError = anyFailed ? 'partial provider failure' : null;

    if (anyUpdated) {
      broadcast('updating');
    } else {
      // Total failure: keep last valid quotes, tell clients the data is stale.
      broadcast('error');
    }
  } catch (error) {
    state.lastError = String(error?.message || 'unknown');
    broadcast('error');
  } finally {
    state.pollInFlight = false;
  }
};

// ----------------------------------------------------------
// Lifecycle
// ----------------------------------------------------------

const start = () => {
  // Guard: never allow duplicate timers if this module is re-required.
  if (state.started) {
    return;
  }

  // Seed the snapshot with subscribed symbols so clients always know the set.
  resolveSymbols().forEach(({ symbol, label }) => {
    if (!state.quotes.has(symbol)) {
      state.quotes.set(symbol, emptyQuote(symbol, label));
    }
  });

  state.started = true;

  // Immediate first fetch (best-effort, don't block startup).
  poll();

  state.pollTimer = setInterval(poll, POLL_INTERVAL_MS);
  state.heartbeatTimer = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL_MS);

  console.log(
    `[market-data] shared poll loop started (${POLL_INTERVAL_MS}ms) for ${state.quotes.size} symbol(s)`
  );
};

const stop = () => {
  if (state.pollTimer) {
    clearInterval(state.pollTimer);
    state.pollTimer = null;
  }
  if (state.heartbeatTimer) {
    clearInterval(state.heartbeatTimer);
    state.heartbeatTimer = null;
  }
  state.started = false;
  state.clients.clear();
};

// ----------------------------------------------------------
// Client hookup (SSE routes)
// ----------------------------------------------------------

const addClient = (res) => {
  state.clients.add(res);
};

const removeClient = (res) => {
  state.clients.delete(res);
};

// Current cached snapshot for REST consumers / initial SSE payload.
const getSnapshot = () => {
  const status =
    state.lastPollAt === null
      ? 'connecting'
      : state.lastError
        ? 'stale'
        : 'connected';
  return buildPayload(status);
};

module.exports = {
  start,
  stop,
  addClient,
  removeClient,
  getSnapshot,
  broadcast,
  isMarketOpen,
  DEFAULT_SYMBOLS,
  POLL_INTERVAL_MS
};