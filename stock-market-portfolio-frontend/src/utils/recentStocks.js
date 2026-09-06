const RECENT_STOCKS_KEY = 'stockpilot_recent_stocks';
const MAX_RECENT_STOCKS = 8;

const isLegacyIpoPlaceholder = (instrument = {}) => {
  const symbol = String(instrument.symbol || instrument || '').trim().toUpperCase();
  const name = String(instrument.companyName || instrument.name || '').trim().toUpperCase();
  const instrumentType = String(instrument.instrumentType || instrument.assetType || '').trim().toUpperCase();
  const marketType = String(instrument.marketType || '').trim().toUpperCase();

  return symbol === 'IPO' ||
    name === 'RENAISSANCE IPO ETF' ||
    instrumentType === 'IPO' ||
    marketType === 'PRIMARY_MARKET';
};

// Frontend-only convenience: remembers the last few symbols the user opened.
// Contains no sensitive data - just stock symbols.
export const getRecentStocks = () => {
  try {
    const raw = window.localStorage.getItem(RECENT_STOCKS_KEY);

    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw);

    if (!Array.isArray(parsed)) {
      return [];
    }

    const cleaned = parsed
      .filter((item) => {
        const symbol = typeof item === 'string' ? item : item?.symbol;
        return typeof symbol === 'string' && symbol.trim();
      })
      .filter((item) => !isLegacyIpoPlaceholder(item))
      .map((item) => (typeof item === 'string' ? item : item.symbol).trim().toUpperCase())
      .filter((item) => !isLegacyIpoPlaceholder(item));

    // Migrate only the legacy IPO placeholder; retain legitimate symbols.
    if (cleaned.length !== parsed.length) {
      window.localStorage.setItem(RECENT_STOCKS_KEY, JSON.stringify(cleaned.slice(0, MAX_RECENT_STOCKS)));
    }

    return cleaned
      .slice(0, MAX_RECENT_STOCKS);
  } catch {
    // Corrupted or unavailable localStorage should never break the UI.
    return [];
  }
};

export const addRecentStock = (instrument) => {
  if (!instrument || (typeof instrument !== 'string' && typeof instrument !== 'object')) {
    return;
  }

  if (isLegacyIpoPlaceholder(instrument)) {
    return;
  }

  const symbol = typeof instrument === 'string' ? instrument : instrument.symbol;

  const cleanSymbol = String(symbol || '').trim().toUpperCase();

  if (!cleanSymbol) {
    return;
  }

  const updated = [
    cleanSymbol,
    ...getRecentStocks().filter((item) => item !== cleanSymbol)
  ].slice(0, MAX_RECENT_STOCKS);

  try {
    window.localStorage.setItem(RECENT_STOCKS_KEY, JSON.stringify(updated));
  } catch {
    // Storage may be unavailable (private mode); the app works without it.
  }
};

export const isStockInstrument = (instrument) => !isLegacyIpoPlaceholder(instrument);
