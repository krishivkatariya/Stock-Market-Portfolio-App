// ==========================================================
// marketDataProvider.js
//
// Clean REST fallback abstraction for market data.
//
// Wraps the existing yahoo-finance2 based stockService with:
//   - Consistent normalized output shape (matches WS event format)
//   - Safe error handling — never crashes, never fabricates prices
//   - Last-valid-quote preservation on transient failures
//   - Clear source tagging so callers know this is REST data
//
// This is intentionally thin: it delegates all HTTP/API logic to
// the existing stockService which is well tested and stable.
// ==========================================================

const { getStockQuote } = require('./stockService');

// Cache of last successfully fetched quote per symbol.
// Key: symbol (uppercase string)  Value: normalized quote object
const lastValidQuotes = new Map();

// ----------------------------------------------------------
// Normalize a raw yahoo-finance2 quote into the compact shape
// used throughout the market pipeline.
// ----------------------------------------------------------

/**
 * @param {string} symbol
 * @param {string} label    Human-readable label (e.g. "NIFTY 50")
 * @param {object} rawQuote Raw yahoo-finance2 quote object
 * @returns {object} Normalized quote
 */
const normalizeRestQuote = (symbol, label, rawQuote) => {
    if (!rawQuote) {
        throw new Error(`[marketDataProvider] No quote returned for ${symbol}`);
    }

    const price = Number(rawQuote.regularMarketPrice);

    if (!Number.isFinite(price) || price <= 0) {
        throw new Error(
            `[marketDataProvider] Invalid regularMarketPrice for ${symbol}`
        );
    }

    const change = Number(rawQuote.regularMarketChange);
    const percentChange = Number(rawQuote.regularMarketChangePercent);

    return {
        symbol,
        label,
        price,
        change: Number.isFinite(change) ? change : null,
        percentChange: Number.isFinite(percentChange) ? percentChange : null,
                // yahoo-finance2 v4 returns regularMarketTime as a Date object.
        // Handle both Date objects and Unix-seconds numbers safely.
        timestamp:
            rawQuote.regularMarketTime
                ? (rawQuote.regularMarketTime instanceof Date
                    ? rawQuote.regularMarketTime.getTime()
                    : Number(rawQuote.regularMarketTime) * 1000)
                : Date.now(),
        source: 'rest_fallback',
        isLive: false
    };
};

// ----------------------------------------------------------
// Public API
// ----------------------------------------------------------

/**
 * Fetch a fresh REST quote for a single symbol.
 *
 * On success  → returns the normalized quote AND updates the internal cache.
 * On failure  → returns the last valid cached quote (stale but honest) or
 *               throws if there is no prior quote.
 *
 * NEVER fabricates a price.
 *
 * @param {string} symbol   Ticker symbol (e.g. "AAPL", "^NSEI")
 * @param {string} [label]  Display label; falls back to symbol
 * @returns {Promise<object>} Normalized quote
 */
const fetchRestQuote = async (symbol, label) => {
    const cleanSymbol = String(symbol).trim().toUpperCase();
    const displayLabel = label || cleanSymbol;

    try {
        const rawQuote = await getStockQuote(cleanSymbol);
        const normalized = normalizeRestQuote(cleanSymbol, displayLabel, rawQuote);

        // Cache the successful result.
        lastValidQuotes.set(cleanSymbol, normalized);

        return normalized;
    } catch (error) {
        // If we have a prior valid quote, return it with a stale marker.
        const cached = lastValidQuotes.get(cleanSymbol);

        if (cached) {
            return {
                ...cached,
                stale: true,
                staleReason: String(error?.message || 'provider error')
            };
        }

        // No cached quote — rethrow so callers can handle the absence.
        throw error;
    }
};

/**
 * Fetch REST quotes for multiple symbols concurrently.
 *
 * Returns an array of results. Each element is either:
 *   { status: 'fulfilled', symbol, quote }
 *   { status: 'rejected', symbol, reason }
 *
 * Failed individual symbols never prevent the rest from resolving.
 *
 * @param {Array<{symbol: string, label?: string}>} entries
 * @returns {Promise<Array>}
 */
const fetchRestQuotes = async (entries) => {
    const results = await Promise.allSettled(
        entries.map(async ({ symbol, label }) => {
            const quote = await fetchRestQuote(symbol, label);
            return { symbol: String(symbol).trim().toUpperCase(), quote };
        })
    );

    return results.map((result, index) => {
        if (result.status === 'fulfilled') {
            return { status: 'fulfilled', ...result.value };
        }

        return {
            status: 'rejected',
            symbol: String(entries[index]?.symbol || '').trim().toUpperCase(),
            reason: String(result.reason?.message || result.reason || 'unknown')
        };
    });
};

/**
 * Return the last known cached quote for a symbol, or null.
 * Useful for initial snapshots before the first REST poll.
 *
 * @param {string} symbol
 * @returns {object|null}
 */
const getCachedQuote = (symbol) => {
    return lastValidQuotes.get(String(symbol).trim().toUpperCase()) || null;
};

/**
 * Clear the internal quote cache.
 * Intended for testing; not needed during normal operation.
 */
const clearCache = () => {
    lastValidQuotes.clear();
};

module.exports = {
    fetchRestQuote,
    fetchRestQuotes,
    getCachedQuote,
    clearCache
};
