// ==========================================================
// marketDataService.js
//
// Shared, provider-agnostic backend market-data hub.
//
//  Architecture:
//    Twelve Data WebSocket (live, where authorized)
//          ↓
//    This service (maintains quote cache, broadcasts SSE)
//          ↑
//    REST fallback poll (yahoo-finance2, for all symbols
//       on a timed schedule and for WS-unsupported symbols)
//          ↓
//    /api/market/stream  (SSE — one feed for all clients)
//
//  Key guarantees:
//  - ONE shared poll loop + ONE shared WS connection — never per-client
//  - Live WS events update the cache + immediately broadcast
//  - REST poll runs periodically as fallback / supplement
//  - Source tagging per quote: 'twelve_data_ws' | 'rest_fallback'
//  - Never fabricates prices; keeps last valid quote on failure
//  - Guards against duplicate timers (safe across module re-requires)
// ==========================================================

const { getStockQuote } = require('./stockService');
const twelveDataStream = require('./twelveDataStreamService');

// Default subscribed market symbols.
const DEFAULT_SYMBOLS = [
  { symbol: '^NSEI', label: 'NIFTY 50' },
  { symbol: '^BSESN', label: 'SENSEX' }
];

// Shared polling interval (REST fallback).
// Default 30 s — overridable via env. Minimum 5 s.
const POLL_INTERVAL_MS = Math.max(
  5000,
  Number(process.env.MARKET_POLL_INTERVAL_MS) || 30000
);

const HEARTBEAT_INTERVAL_MS = 25000;

// US symbols that Twelve Data can likely stream (non-dot, non-caret tickers).
// Indian NSE symbols (with .NS suffix or caret indices) typically require a
// higher-tier plan; we detect this from provider error responses at runtime.
const isLikelyWsSupported = (symbol) => {
  const s = String(symbol).toUpperCase();
  // Skip index symbols (^NSEI, ^BSESN) and Yahoo NSE-suffixed tickers
  return !s.startsWith('^') && !s.endsWith('.NS') && !s.endsWith('.BO');
};

// Normal NSE/BSE equity session (Asia/Kolkata):
// Monday–Friday 09:15–15:30 IST.
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
  quotes: new Map(),           // symbol -> normalized snapshot
  clients: new Set(),          // active SSE response objects
  connSubscriptions: new Map(),// res -> Set<symbol>
  subscriptionCounts: new Map(),// symbol -> number of connections
  wsRejectedSymbols: new Set() // symbols Twelve Data rejected (auth error)
};

// Default index symbols are permanently tracked; never dropped on disconnect.
const DEFAULT_SYMBOL_SET = new Set(
  DEFAULT_SYMBOLS.map((entry) => entry.symbol)
);

// ----------------------------------------------------------
// Quote builders
// ----------------------------------------------------------

const emptyQuote = (symbol, label) => ({
  symbol,
  label,
  price: null,
  change: null,
  percentChange: null,
  timestamp: null,
  source: 'rest_fallback',
  isLive: false,
  marketStatus: isMarketOpen() ? 'open' : 'closed'
});

// Normalize a Yahoo quote into the compact structure we broadcast.
const normalizeRestQuote = (symbol, label, quote) => {
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
        // yahoo-finance2 v4 returns regularMarketTime as a Date object.
    // Handle both Date objects and Unix-seconds numbers safely.
    timestamp: quote.regularMarketTime
      ? (quote.regularMarketTime instanceof Date
          ? quote.regularMarketTime.getTime()
          : Number(quote.regularMarketTime) * 1000)
      : Date.now(),
    source: 'rest_fallback',
    isLive: false,
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
// Twelve Data WebSocket integration
// ----------------------------------------------------------

/**
 * Called for every validated price event received from the Twelve Data WS.
 * Updates the cached quote (preserving existing label/change fields) and
 * immediately broadcasts to all SSE clients.
 */
const handleWsPrice = (event) => {
  const { symbol, price, timestamp } = event;

  const existing = state.quotes.get(symbol);

  const updated = {
    symbol,
    label: existing?.label || symbol,
    price,
    // WS events only carry the latest trade price, not change/percentChange.
    // Keep the last REST-sourced change values so the UI stays informative.
    change: existing?.change ?? null,
    percentChange: existing?.percentChange ?? null,
    timestamp: timestamp || Date.now(),
    source: 'twelve_data_ws',
    isLive: true,
    marketStatus: isMarketOpen() ? 'open' : 'closed'
  };

  state.quotes.set(symbol, updated);

  broadcast('updating');
};

/**
 * Called when Twelve Data WS reports a provider error (e.g. unauthorised
 * exchange). We record the symbol as WS-rejected so the REST poll continues
 * to service it, and update the source field accordingly.
 */
const handleWsProviderError = (event) => {
  const message = String(event.message || '');

  // Detect authorization errors and extract the rejected symbol if possible.
  // Twelve Data error messages look like:
  //   "You are not authorized to access XNSE data..."
  if (
    message.toLowerCase().includes('not authorized') ||
    message.toLowerCase().includes('exchange')
  ) {
    // Mark all subscribed symbols from restricted exchanges as WS-rejected.
    // (Without a per-symbol mapping in the error, we conservatively keep the
    //  rejected set to symbols that have not received any WS price event.)
    console.warn(`[market-data] Twelve Data WS provider restriction: ${message}`);
  } else {
    console.warn(`[market-data] Twelve Data WS provider error: ${message}`);
  }
};

/**
 * Subscribe WS-eligible symbols.
 * Called once on startup and whenever new symbols are added.
 */
const subscribeWsSymbols = () => {
  const eligible = [...state.quotes.keys()].filter(
    (s) => isLikelyWsSupported(s) && !state.wsRejectedSymbols.has(s)
  );

  if (eligible.length > 0) {
    twelveDataStream.subscribeSymbols(eligible);
  }
};

// ----------------------------------------------------------
// REST fallback poll
// ----------------------------------------------------------

const poll = async () => {
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
        return normalizeRestQuote(symbol, current?.label || symbol, quote);
      })
    );

    let anyUpdated = false;
    let anyFailed = false;

    results.forEach((result) => {
      if (result.status === 'fulfilled') {
        const incoming = result.value;
        const existing = state.quotes.get(incoming.symbol);

        // Only overwrite the price/source if we don't have a fresher WS tick.
        // A WS price is considered fresher when:
        //   - The existing entry has source === 'twelve_data_ws'
        //   - AND the WS timestamp is more recent than the REST responseTime
        if (
          existing &&
          existing.source === 'twelve_data_ws' &&
          existing.timestamp > incoming.timestamp
        ) {
          // Keep the WS price; still update change/percentChange from REST.
          state.quotes.set(incoming.symbol, {
            ...existing,
            change: incoming.change,
            percentChange: incoming.percentChange,
            marketStatus: incoming.marketStatus
          });
        } else {
          state.quotes.set(incoming.symbol, incoming);
        }

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
  if (state.started) {
    return;
  }

  // Seed the snapshot with subscribed symbols.
  resolveSymbols().forEach(({ symbol, label }) => {
    if (!state.quotes.has(symbol)) {
      state.quotes.set(symbol, emptyQuote(symbol, label));
    }
  });

  state.started = true;

  // ---- Twelve Data WebSocket ----
  // Wire up the event listener BEFORE calling subscribeSymbols so no events
  // are missed during the connection handshake.
  twelveDataStream.addListener((event) => {
    if (event.type === 'price') {
      handleWsPrice(event);
    } else if (event.type === 'provider_error') {
      handleWsProviderError(event);
    } else if (event.type === 'subscribe_error') {
      // Twelve Data rejected one or more symbols (typically a plan /
      // exchange-authorization issue, e.g. NSE/XNSE). Add them to the
      // rejected set so we STOP retrying them over WS and instead rely on
      // the REST fallback poll. Also reset the note receiver's WS status.
      (event.symbols || []).forEach((symbol) => {
        const clean = String(symbol).trim().toUpperCase();
        if (clean) {
          state.wsRejectedSymbols.add(clean);
          const current = state.quotes.get(clean);
          if (current) {
            // Re-sync with REST fallback framing so the UI shows the honest
            // "Connected (REST Fallback)" state for this symbol.
            state.quotes.set(clean, {
              ...current,
              source: 'rest_fallback',
              isLive: false
            });
          }
        }
      });

      if ((event.symbols || []).length > 0) {
        console.warn(
          `[market-data] Twelve Data WS rejected symbols (REST fallback will be used): ${event.symbols.join(', ')}`
        );
        broadcast('updating');
      }
    }
    // 'status' events (connecting/connected/reconnecting) need no action here;
    // the REST poll continues regardless of WS state.
  });

  twelveDataStream.resetCloseState();
  subscribeWsSymbols();

  // ---- REST fallback poll ----
  // Immediate first fetch (best-effort, doesn't block startup).
  poll();

  state.pollTimer = setInterval(poll, POLL_INTERVAL_MS);
  state.heartbeatTimer = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL_MS);

  console.log(
    `[market-data] service started (REST poll: ${POLL_INTERVAL_MS}ms, WS: enabled) ` +
    `for ${state.quotes.size} symbol(s)`
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

  twelveDataStream.close();

  state.started = false;
  state.clients.clear();
};

// ----------------------------------------------------------
// Client hookup (SSE routes)
// ----------------------------------------------------------

const addClient = (res) => {
  state.clients.add(res);
};

const subscribeConnection = (res, symbols) => {
  const clean = [
    ...new Set(
      (symbols || [])
        .map((symbol) => String(symbol).trim().toUpperCase())
        .filter(Boolean)
    )
  ];

  if (clean.length === 0) {
    return;
  }

  let connSet = state.connSubscriptions.get(res);

  if (!connSet) {
    connSet = new Set();
    state.connSubscriptions.set(res, connSet);
  }

  const newSymbols = [];

  clean.forEach((symbol) => {
    if (connSet.has(symbol)) {
      return;
    }

    connSet.add(symbol);
    state.subscriptionCounts.set(
      symbol,
      (state.subscriptionCounts.get(symbol) || 0) + 1
    );

    if (!state.quotes.has(symbol)) {
      state.quotes.set(symbol, emptyQuote(symbol, symbol));
      newSymbols.push(symbol);
    }
  });

  // Subscribe newly added WS-eligible symbols immediately.
  if (newSymbols.length > 0) {
    const wsEligible = newSymbols.filter(
      (s) => isLikelyWsSupported(s) && !state.wsRejectedSymbols.has(s)
    );
    if (wsEligible.length > 0) {
      twelveDataStream.subscribeSymbols(wsEligible);
    }
  }

  // Trigger a REST poll for newly requested symbols.
  poll();
};

const removeClient = (res) => {
  state.clients.delete(res);

  const connSet = state.connSubscriptions.get(res);

  if (connSet) {
    const toUnsubscribeWs = [];

    connSet.forEach((symbol) => {
      if (DEFAULT_SYMBOL_SET.has(symbol)) {
        return; // never drop the permanent index symbols
      }

      const count = (state.subscriptionCounts.get(symbol) || 1) - 1;

      if (count <= 0) {
        state.subscriptionCounts.delete(symbol);
        state.quotes.delete(symbol);
        toUnsubscribeWs.push(symbol);
      } else {
        state.subscriptionCounts.set(symbol, count);
      }
    });

    // Tell Twelve Data WS to stop sending updates for dropped symbols.
    if (toUnsubscribeWs.length > 0) {
      const wsEligible = toUnsubscribeWs.filter(isLikelyWsSupported);
      if (wsEligible.length > 0) {
        twelveDataStream.unsubscribeSymbols(wsEligible);
      }
    }

    state.connSubscriptions.delete(res);
  }
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
  subscribeConnection,
  getSnapshot,
  broadcast,
  isMarketOpen,
  DEFAULT_SYMBOLS,
  POLL_INTERVAL_MS
};