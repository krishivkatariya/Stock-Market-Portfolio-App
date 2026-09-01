// ==========================================================
// marketStreamService.js
//
// Reusable real-time market-data client (Server-Sent Events).
//
//  - Connects to the backend SSE stream (GET /api/market/stream).
//  - One shared EventSource across all subscribers (ref-counted).
//  - Auto-reconnects after connection loss.
//  - Cleans up the connection when the last subscriber unsubscribes.
//
// No authentication is sent: index quotes are public (same as /api/stocks).
// ==========================================================

const API_BASE = 'http://localhost:5000/api';
const STREAM_URL = `${API_BASE}/market/stream`;

const RECONNECT_DELAY_MS = 3000;

let eventSource = null;
let subscriberCount = 0;
let intentionalClose = false;

// Union of symbols that live subscribers currently want (Stock Details /
// Watchlist). The shared EventSource includes them in its query string so the
// backend's single poll loop tracks exactly the symbols anyone needs.
const requestedSymbols = new Set();

// Each subscriber: { onMessage(message), onStatus(status) }
const subscribers = new Set();

let status = 'idle'; // idle | connecting | connected | reconnecting | error

const setStatus = (next) => {
  if (status === next) {
    return;
  }
  status = next;
  subscribers.forEach((subscriber) => {
    try {
      subscriber.onStatus?.(status);
    } catch {
      // subscriber callback must never break the stream
    }
  });
};

const notifyMessage = (message) => {
  subscribers.forEach((subscriber) => {
    try {
      subscriber.onMessage?.(message);
    } catch {
      // subscriber callback must never break the stream
    }
  });
};

const closeCurrent = () => {
  if (eventSource) {
    const current = eventSource;
    eventSource = null;
    current.close();
  }
};

const buildStreamUrl = () => {
  if (requestedSymbols.size === 0) {
    return STREAM_URL;
  }

  const symbols = [...requestedSymbols].map(encodeURIComponent).join(',');
  return `${STREAM_URL}?symbols=${symbols}`;
};

const connect = () => {
  if (eventSource) {
    return;
  }

  if (typeof EventSource === 'undefined') {
    setStatus('error');
    return;
  }

  setStatus('connecting');

  const es = new EventSource(buildStreamUrl());
  eventSource = es;

  es.addEventListener('market', (event) => {
    try {
      const data = JSON.parse(event.data);
      notifyMessage(data);
      setStatus('connected');
    } catch {
      // ignore malformed frames
    }
  });

  es.onopen = () => {
    setStatus('connected');
  };

  es.onerror = () => {
    if (es.readyState === EventSource.CLOSED) {
      // Guard against double-close if a newer connection has already been made.
      if (eventSource === es) {
        eventSource = null;
      }

      setStatus('reconnecting');

      if (intentionalClose) {
        // We closed on purpose (symbol set changed / teardown); the caller
        // reconnects immediately if it should.
        intentionalClose = false;
        return;
      }

      window.setTimeout(() => {
        if (subscriberCount > 0 && !eventSource) {
          connect();
        }
      }, RECONNECT_DELAY_MS);
    } else {
      // CONNECTING: EventSource retries automatically; just surface the state.
      setStatus('reconnecting');
    }
  };
};

// Close + reopen the shared stream so the backend sees the updated symbol set.
const restartConnection = () => {
  if (!eventSource) {
    return;
  }

  intentionalClose = true;
  closeCurrent();

  if (subscriberCount > 0) {
    connect();
  }
};

/**
 * Subscribe to real-time market updates.
 *
 * @param {Function|{onMessage: Function, onStatus: Function}} callbacks
 * @returns {Function} unsubscribe function
 */
export const subscribeToMarket = (callbacks = {}) => {
  const onMessage =
    typeof callbacks === 'function' ? callbacks : callbacks.onMessage;
  const onStatus = callbacks.onStatus;

  const entry = { onMessage, onStatus };
  subscribers.add(entry);

  if (subscriberCount === 0) {
    connect();
  }
  subscriberCount += 1;

  return () => {
    subscribers.delete(entry);
    subscriberCount = Math.max(0, subscriberCount - 1);

    if (subscriberCount === 0) {
      closeCurrent();
      setStatus('idle');
    }
  };
};

/**
 * Subscribe to real-time updates for a specific set of stock symbols.
 *
 * The symbols are unioned into the shared EventSource so the backend's ONE
 * poll loop fetches each unique symbol once, no matter how many pages/symbols
 * request it. When the set changes the shared stream reconnects once.
 *
 * @param {string[]} symbols - symbols to request live updates for
 * @param {Function|{onMessage: Function, onStatus: Function}} callbacks
 * @returns {Function} unsubscribe function
 */
export const subscribeToMarketSymbols = (symbols, callbacks = {}) => {
  const clean = (symbols || [])
    .map((symbol) => String(symbol).trim().toUpperCase())
    .filter(Boolean);

  const hadConnection = !!eventSource;

  clean.forEach((symbol) => requestedSymbols.add(symbol));

  const unsubscribe = subscribeToMarket(callbacks);

  if (hadConnection) {
    // An open stream exists; restart it so the backend applies the new set.
    restartConnection();
  }

  return () => {
    clean.forEach((symbol) => requestedSymbols.delete(symbol));

    const hadOtherSubscribers = subscriberCount > 1;
    unsubscribe();

    if (hadOtherSubscribers) {
      // The stream stays open for other subscribers; drop our symbols.
      restartConnection();
    }
  };
};

/**
 * Fetch the current backend market snapshot via REST (fallback / initial load).
 */
export const fetchMarketSnapshot = async () => {
  const response = await fetch(`${API_BASE}/market/snapshot`);
  if (!response.ok) {
    throw new Error('Market snapshot unavailable');
  }
  return response.json();
};

export const getMarketStreamStatus = () => status;