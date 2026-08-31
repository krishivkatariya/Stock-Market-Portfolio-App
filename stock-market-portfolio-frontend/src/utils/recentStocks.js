const RECENT_STOCKS_KEY = 'stockpilot_recent_stocks';
const MAX_RECENT_STOCKS = 8;

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

    return parsed
      .filter((item) => typeof item === 'string' && item.trim())
      .map((item) => item.trim().toUpperCase())
      .slice(0, MAX_RECENT_STOCKS);
  } catch {
    // Corrupted or unavailable localStorage should never break the UI.
    return [];
  }
};

export const addRecentStock = (symbol) => {
  if (!symbol || typeof symbol !== 'string') {
    return;
  }

  const cleanSymbol = symbol.trim().toUpperCase();

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
