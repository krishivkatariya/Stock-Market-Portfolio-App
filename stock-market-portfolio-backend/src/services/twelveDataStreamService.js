const WebSocket = require('ws');

const TWELVE_DATA_WS_URL =
  `wss://ws.twelvedata.com/v1/quotes/price?apikey=${process.env.TWELVE_DATA_API_KEY}`;

const INITIAL_RECONNECT_DELAY_MS = 3000;
const MAX_RECONNECT_DELAY_MS = 30000;
const HEARTBEAT_INTERVAL_MS = 15000;
// A connection is "stable" once it has stayed open for at least this long.
// Used to decide whether reconnect backoff should be reset to its minimum.
const STABLE_CONNECTION_MS = 30000;

let socket = null;
let reconnectTimer = null;
let heartbeatTimer = null;

let reconnectDelay = INITIAL_RECONNECT_DELAY_MS;
let intentionallyClosed = false;
// Tracks how long the current/last connection stayed open so we only reset
// reconnect backoff after a stable connection. Prevents a reconnect storm when
// the provider closes idle connections quickly (e.g. outside market hours).
let openedAt = null;
let lastConnectionDurationMs = null;

const subscriptions = new Set();
const listeners = new Set();

let status = 'idle';

const notifyListeners = (event) => {
  listeners.forEach((listener) => {
    try {
      listener(event);
    } catch {
      // A listener must never break the market stream.
    }
  });
};

const setStatus = (nextStatus) => {
  if (status === nextStatus) {
    return;
  }

  status = nextStatus;

  notifyListeners({
    type: 'status',
    status: nextStatus
  });
};

const clearHeartbeat = () => {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
};

const startHeartbeat = () => {
  clearHeartbeat();

  heartbeatTimer = setInterval(() => {
    if (socket && socket.readyState === WebSocket.OPEN) {
      try {
        socket.send(JSON.stringify({
          action: 'heartbeat'
        }));
      } catch {
        // Socket will reconnect through normal error handling.
      }
    }
  }, HEARTBEAT_INTERVAL_MS);
};

const sendSubscriptions = () => {
  if (
    !socket ||
    socket.readyState !== WebSocket.OPEN ||
    subscriptions.size === 0
  ) {
    return;
  }

  const symbols = [...subscriptions];

  socket.send(
    JSON.stringify({
      action: 'subscribe',
      params: {
        symbols: symbols.join(',')
      }
    })
  );
};

const scheduleReconnect = () => {
  if (intentionallyClosed || reconnectTimer) {
    return;
  }

  const delay = reconnectDelay;

  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;

    if (!intentionallyClosed) {
      connect();
    }
  }, delay);

  reconnectDelay = Math.min(
    reconnectDelay * 2,
    MAX_RECONNECT_DELAY_MS
  );
};

const connect = () => {
  if (intentionallyClosed) {
    return;
  }

  if (
    socket &&
    (
      socket.readyState === WebSocket.OPEN ||
      socket.readyState === WebSocket.CONNECTING
    )
  ) {
    return;
  }

  const apiKey = process.env.TWELVE_DATA_API_KEY;

  if (!apiKey) {
    setStatus('error');

    notifyListeners({
      type: 'provider_error',
      message: 'TWELVE_DATA_API_KEY is not configured.'
    });

    return;
  }

  setStatus('connecting');

  const wsUrl =
    `wss://ws.twelvedata.com/v1/quotes/price?apikey=${encodeURIComponent(apiKey)}`;

  const currentSocket = new WebSocket(wsUrl);

  socket = currentSocket;

  currentSocket.on('open', () => {
    if (socket !== currentSocket) {
      return;
    }

    // Only reset the reconnect backoff if the previous connection was stable
    // for a reasonable amount of time. If the provider keeps closing the socket
    // quickly (idle timeout outside market hours), let backoff keep growing so
    // we don't hammer the endpoint with a reconnect storm.
    if (
      lastConnectionDurationMs === null ||
      lastConnectionDurationMs >= STABLE_CONNECTION_MS
    ) {
      reconnectDelay = INITIAL_RECONNECT_DELAY_MS;
    }

    openedAt = Date.now();

    setStatus('connected');

    startHeartbeat();

    sendSubscriptions();
  });

  currentSocket.on('message', (rawMessage) => {
    if (socket !== currentSocket) {
      return;
    }

    try {
      const message = JSON.parse(rawMessage.toString());

      /*
       * Twelve Data sends price events containing fields such as:
       *
       * {
       *   event: "price",
       *   symbol: "AAPL",
       *   price: "250.42",
       *   timestamp: 1760000000
       * }
       */

      if (message.event === 'price') {
        const symbol = String(
          message.symbol || ''
        ).trim().toUpperCase();

        const price = Number(message.price);

        if (
          !symbol ||
          !Number.isFinite(price) ||
          price <= 0
        ) {
          return;
        }

        notifyListeners({
          type: 'price',
          symbol,
          price,
          timestamp: Number(message.timestamp) || Date.now(),
          source: 'twelve_data_ws',
          isLive: true
        });

        return;
      }

      if (message.event === 'subscribe-status') {
        // Twelve Data reports per-symbol subscription results:
        //   { event: "subscribe-status", status: "ok", success: [...], fails: null }
        //   { event: "subscribe-status", status: "error",
        //     success: null, fails: [{ symbol: "RELIANCE" }, ...] }
        // A failed subscribe usually means the current plan does NOT authorize
        // that exchange (e.g. Indian NSE/XNSE). Report the rejected symbols so
        // the caller can switch them to REST fallback instead of retrying.
        const failedSymbols = Array.isArray(message.fails)
          ? message.fails
            .map((entry) =>
              String(entry?.symbol || entry || '').trim().toUpperCase()
            )
            .filter(Boolean)
          : [];

        if (message.status !== 'ok' || failedSymbols.length > 0) {
          // Drop rejected symbols from the local subscription set so we never
          // re-send them on later connect/reconnect cycles.
          failedSymbols.forEach((symbol) => {
            subscriptions.delete(symbol);
          });

          notifyListeners({
            type: 'subscribe_error',
            symbols: failedSymbols,
            message:
              message.status === 'error'
                ? 'Twelve Data rejected one or more symbols.'
                : 'Partial subscription result from Twelve Data.',
            raw: message
          });
        }

        return;
      }

      if (message.event === 'heartbeat') {
        return;
      }

      if (
        message.status === 'error' ||
        message.event === 'error'
      ) {
        notifyListeners({
          type: 'provider_error',
          message:
            message.message ||
            message.description ||
            'Twelve Data WebSocket error.'
        });
      }
    } catch {
      // Ignore malformed provider messages.
    }
  });

  currentSocket.on('error', (error) => {
    if (socket !== currentSocket) {
      return;
    }

    notifyListeners({
      type: 'provider_error',
      message:
        error?.message ||
        'Twelve Data WebSocket connection error.'
    });

    setStatus('error');
  });

  currentSocket.on('close', () => {
    if (socket === currentSocket) {
      socket = null;
    }

    // Record how long this connection lasted before closing; used by the
    // 'open' handler to decide whether backoff should be reset.
    if (openedAt !== null) {
      lastConnectionDurationMs = Date.now() - openedAt;
      openedAt = null;
    }

    clearHeartbeat();

    if (intentionallyClosed) {
      setStatus('idle');
      return;
    }

    setStatus('reconnecting');

    scheduleReconnect();
  });
};

const subscribeSymbols = (symbols) => {
  const cleanSymbols = (symbols || [])
    .map((symbol) => String(symbol).trim().toUpperCase())
    .filter(Boolean);

  cleanSymbols.forEach((symbol) => {
    subscriptions.add(symbol);
  });

  connect();

  if (
    socket &&
    socket.readyState === WebSocket.OPEN &&
    cleanSymbols.length > 0
  ) {
    socket.send(
      JSON.stringify({
        action: 'subscribe',
        params: {
          symbols: cleanSymbols.join(',')
        }
      })
    );
  }
};

const unsubscribeSymbols = (symbols) => {
  const cleanSymbols = (symbols || [])
    .map((symbol) => String(symbol).trim().toUpperCase())
    .filter(Boolean);

  cleanSymbols.forEach((symbol) => {
    subscriptions.delete(symbol);
  });

  if (
    socket &&
    socket.readyState === WebSocket.OPEN &&
    cleanSymbols.length > 0
  ) {
    socket.send(
      JSON.stringify({
        action: 'unsubscribe',
        params: {
          symbols: cleanSymbols.join(',')
        }
      })
    );
  }
};

const addListener = (listener) => {
  if (typeof listener !== 'function') {
    throw new TypeError('Market stream listener must be a function.');
  }

  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
};

const close = () => {
  intentionallyClosed = true;

  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }

  clearHeartbeat();

  if (socket) {
    const currentSocket = socket;
    socket = null;
    currentSocket.close();
  }

  setStatus('idle');
};

const resetCloseState = () => {
  intentionallyClosed = false;
};

module.exports = {
  addListener,
  subscribeSymbols,
  unsubscribeSymbols,
  close,
  resetCloseState,
  getStatus: () => status
};