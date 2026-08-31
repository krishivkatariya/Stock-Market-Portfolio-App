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
    eventSource.close();
    eventSource = null;
  }
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

  const es = new EventSource(STREAM_URL);
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
      // Connection permanently closed; schedule a manual reconnect.
      closeCurrent();
      setStatus('reconnecting');
      window.setTimeout(() => {
        if (subscriberCount > 0) {
          connect();
        }
      }, RECONNECT_DELAY_MS);
    } else {
      // CONNECTING: EventSource retries automatically; just surface the state.
      setStatus('reconnecting');
    }
  };
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