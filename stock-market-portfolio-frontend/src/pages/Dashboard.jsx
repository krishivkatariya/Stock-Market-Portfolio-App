import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import api from '../api/api';
import { useAuth } from '../context/useAuth';
import TradeModal from '../components/TradeModal';
import StockCard from '../components/StockCard';
import { getStockQuote } from '../services/stockService';
import { getWatchlist } from '../services/watchlistService';
import { getOrders } from '../services/orderService';
import { getRecentStocks } from '../utils/recentStocks';
import {
  subscribeToMarket,
  fetchMarketSnapshot
} from '../services/marketStreamService';

const SearchIcon = () => (
  <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="11" cy="11" r="6.5" />
    <path d="M16 16l4.5 4.5" />
  </svg>
);

const RefreshIcon = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M1 4v6h6" />
    <path d="M23 20v-6h-6" />
    <path d="M4 20a8 8 0 0 1 16-16v6" />
  </svg>
);

const ArrowRightIcon = () => (
  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M8 5l8 7-8 7" />
  </svg>
);

const SEARCH_DEBOUNCE_MS = 300;
const SEARCH_MIN_CHARS = 2;
const SEARCH_RESULTS_LIMIT = 8;
const PREVIEW_LIMIT = 5;

// Curated large-cap symbols for Discover / Top movers.
// Every price shown comes from the existing quote endpoint - nothing is fabricated.
const DISCOVERY_SYMBOLS = ['RELIANCE', 'TCS', 'HDFCBANK', 'INFY', 'ICICIBANK', 'SBIN'];

const MARKET_INDEXES = [
  { symbol: '^NSEI', label: 'NIFTY 50' },
  { symbol: '^BSESN', label: 'SENSEX' }
];

const currencyFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 2
});

const formatCurrency = (value) => {
  const numeric = Number(value);
  if (value === null || value === undefined || Number.isNaN(numeric)) {
    return '--';
  }
  return currencyFormatter.format(numeric);
};

const formatSignedCurrency = (value) => {
  const numeric = Number(value);
  if (value === null || value === undefined || Number.isNaN(numeric)) {
    return '--';
  }
  return `${numeric >= 0 ? '+' : '-'}${currencyFormatter.format(Math.abs(numeric))}`;
};

const formatPercent = (value) => {
  const numeric = Number(value);
  if (value === null || value === undefined || Number.isNaN(numeric)) {
    return '--';
  }
  return `${numeric >= 0 ? '+' : ''}${numeric.toFixed(2)}%`;
};

const formatDate = (value) => {
  if (!value) {
    return '--';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '--';
  }
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

const formatUpdatedTime = (date) => {
  if (!date || Number.isNaN(new Date(date).getTime())) {
    return '';
  }
  return new Date(date).toLocaleTimeString('en-IN', {
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  });
};

const friendlyError = (error, fallback) => {
  if (error?.response) {
    return error?.response?.data?.message || fallback;
  }
  return 'Unable to reach the server. Check your connection and try again.';
};

const resultName = (result) =>
  result?.shortname || result?.longname || result?.companyName || result?.name || result?.symbol || '';

const orderSide = (order) => (order?.side || order?.orderType || '').toUpperCase();

const orderStatusClass = (status) => {
  const normalized = (status || '').toLowerCase();
  return ['completed', 'pending', 'cancelled', 'rejected'].includes(normalized)
    ? normalized
    : 'other';
};

const Dashboard = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [availableCash, setAvailableCash] = useState(null);
  const [holdings, setHoldings] = useState([]);
  const [portfolioTotals, setPortfolioTotals] = useState({
    invested: null,
    value: null,
    profitLoss: null
  });
  const [overviewLoading, setOverviewLoading] = useState(true);


  const [indexes, setIndexes] = useState([]);
  const [marketLoading, setMarketLoading] = useState(true);
  const [marketError, setMarketError] = useState('');
  const [lastMarketUpdate, setLastMarketUpdate] = useState(null);
  const [marketStreamStatus, setMarketStreamStatus] = useState('connecting');
  const [marketSession, setMarketSession] = useState(null); // 'open' | 'closed' | null
  const [marketDataSource, setMarketDataSource] = useState(null); // 'twelve_data_ws' | 'rest_fallback' | null

  const [discoveryCards, setDiscoveryCards] = useState([]);
  const [discoveryLoading, setDiscoveryLoading] = useState(true);
  const [discoveryError, setDiscoveryError] = useState('');
  const [discoveryKey, setDiscoveryKey] = useState(0);

  const [watchlistStocks, setWatchlistStocks] = useState([]);
  const [watchlistLoading, setWatchlistLoading] = useState(true);
  const [watchlistError, setWatchlistError] = useState('');

  const [recentOrders, setRecentOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [ordersError, setOrdersError] = useState('');

  const [recentSymbols, setRecentSymbols] = useState([]);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);

  const [selectedTrade, setSelectedTrade] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const searchRef = useRef(null);
  const searchInputRef = useRef(null);
  const marketRefreshingRef = useRef(false);

  // ---- Core data: account, portfolio, watchlist, orders ----
  useEffect(() => {
    let active = true;

    const load = async () => {
      setOverviewLoading(true);
      setWatchlistLoading(true);
      setOrdersLoading(true);

      const [accountResult, portfolioResult, watchlistResult, ordersResult] = await Promise.allSettled([
        api.get('/account'),
        api.get('/portfolio'),
        getWatchlist(),
        getOrders()
      ]);

      if (!active) {
        return;
      }

      if (accountResult.status === 'fulfilled') {
        setAvailableCash(Number(accountResult.value?.data?.account?.availableCash ?? 0));

      } else {
        setAvailableCash(null);

      }

      if (portfolioResult.status === 'fulfilled') {
        const portfolio = portfolioResult.value?.data?.portfolio || {};
        setHoldings(Array.isArray(portfolio.stocks) ? portfolio.stocks : []);
        setPortfolioTotals({
          invested: portfolio.totalInvestment ?? null,
          value: portfolio.totalPortfolioValue ?? null,
          profitLoss: portfolio.totalProfitLoss ?? null
        });
      } else {
        setHoldings([]);
        setPortfolioTotals({ invested: null, value: null, profitLoss: null });
      }

      if (watchlistResult.status === 'fulfilled') {
        setWatchlistStocks(
          Array.isArray(watchlistResult.value?.watchlist) ? watchlistResult.value.watchlist : []
        );
        setWatchlistError('');
      } else {
        setWatchlistStocks([]);
        setWatchlistError(friendlyError(watchlistResult.reason, 'Could not load your watchlist.'));
      }

      if (ordersResult.status === 'fulfilled') {
        const orders = Array.isArray(ordersResult.value?.orders) ? ordersResult.value.orders : [];
        setRecentOrders(orders.slice(0, PREVIEW_LIMIT));
        setOrdersError('');
      } else {
        setRecentOrders([]);
        setOrdersError(friendlyError(ordersResult.reason, 'Could not load your recent orders.'));
      }

      setRecentSymbols(getRecentStocks());
      setOverviewLoading(false);
      setWatchlistLoading(false);
      setOrdersLoading(false);
    };

    load();

    return () => {
      active = false;
    };
  }, [refreshKey]);

  // ---- Market overview: real-time stream (SSE via marketStreamService) ----
  // The Dashboard consumes updates pushed by the ONE shared backend loop.
  // There is no per-browser polling interval anymore. A REST snapshot is used
  // once for a fast first render, and the manual refresh button is a fallback.
  useEffect(() => {
    let active = true;

    const applyMessage = (data) => {
      if (!active) {
        return;
      }

      if (data?.marketStatus === 'open' || data?.marketStatus === 'closed') {
        setMarketSession(data.marketStatus);
      }

      const quotes = data?.quotes;
      if (quotes && typeof quotes === 'object') {
        // Determine the dominant data source across all index quotes.
        const indexSources = MARKET_INDEXES
          .map((entry) => quotes[entry.symbol]?.source)
          .filter(Boolean);
        if (indexSources.length > 0) {
          // 'twelve_data_ws' wins if ANY index quote came via WS.
          const dominantSource = indexSources.includes('twelve_data_ws')
            ? 'twelve_data_ws'
            : 'rest_fallback';
          setMarketDataSource(dominantSource);
        }

        setIndexes(() => {
          const bySymbol = {};
          MARKET_INDEXES.forEach((entry) => {
            bySymbol[entry.symbol] = entry;
          });

          Object.entries(quotes).forEach(([symbol, quote]) => {
            const base = bySymbol[symbol];
            if (base) {
              bySymbol[symbol] = {
                ...base,
                ...quote,
                symbol,
                // stream format uses `price`; the cards render `currentPrice`
                currentPrice: quote.price ?? base.currentPrice
              };
            }
          });

          // Preserve the canonical label + order from MARKET_INDEXES.
          return MARKET_INDEXES.map((entry) => bySymbol[entry.symbol]).filter(
            Boolean
          );
        });

        setLastMarketUpdate(new Date());
      }

      if (data?.status === 'error' || data?.status === 'stale') {
        setMarketError('Market data temporarily unavailable. Retrying…');
      } else if (data?.status && data.status !== 'heartbeat') {
        setMarketError('');
      }

      setMarketLoading(false);
    };

    const applyStatus = (next) => {
      if (!active) {
        return;
      }
      setMarketStreamStatus(next);
      if (next === 'connected') {
        setMarketError('');
      }
      if (next === 'error') {
        setMarketLoading(false);
      }
      // 'reconnecting' intentionally keeps the last valid cards on screen.
    };

    const unsubscribe = subscribeToMarket({
      onMessage: applyMessage,
      onStatus: applyStatus
    });

    // Fast first render: one REST snapshot from the shared backend service.
    const fallbackTimer = window.setTimeout(async () => {
      try {
        const snapshot = await fetchMarketSnapshot();
        if (active) {
          applyMessage({ ...snapshot, status: 'updating' });
        }
      } catch {
        // The stream is the primary path; ignore snapshot failure.
      }
    }, 1500);

    return () => {
      active = false;
      window.clearTimeout(fallbackTimer);
      unsubscribe();
    };
  }, []);

  // Manual REST refresh (fallback only — not the normal live mechanism).
  const refreshMarketQuotes = async () => {
    if (marketRefreshingRef.current) {
      return;
    }
    marketRefreshingRef.current = true;
    setMarketLoading(true);

    try {
      const results = await Promise.allSettled(
        MARKET_INDEXES.map((index) => getStockQuote(index.symbol))
      );

      const loaded = [];

      results.forEach((result, position) => {
        if (result.status === 'fulfilled' && result.value?.stock) {
          loaded.push({ ...MARKET_INDEXES[position], ...result.value.stock });
        }
      });

      if (loaded.length > 0) {
        setIndexes(loaded);
        setLastMarketUpdate(new Date());
        setMarketError(
          loaded.length < MARKET_INDEXES.length
            ? 'Some market data is temporarily unavailable. Retrying…'
            : ''
        );
      } else {
        setMarketError('Market data temporarily unavailable. Retrying…');
      }
    } catch {
      setMarketError('Market data temporarily unavailable. Retrying…');
    } finally {
      setMarketLoading(false);
      marketRefreshingRef.current = false;
    }
  };

  // ---- Discover: recently viewed symbols when available, otherwise curated large caps ----
  const discoverySymbols = useMemo(
    () =>
      recentSymbols.length > 0
        ? recentSymbols.slice(0, PREVIEW_LIMIT)
        : DISCOVERY_SYMBOLS,
    [recentSymbols]
  );

  useEffect(() => {
    let active = true;

    const load = async () => {
      setDiscoveryLoading(true);
      setDiscoveryError('');

      const results = await Promise.allSettled(
        discoverySymbols.map((symbol) => getStockQuote(symbol))
      );

      if (!active) {
        return;
      }

      const loaded = [];

      results.forEach((result) => {
        if (result.status === 'fulfilled' && result.value?.stock) {
          loaded.push(result.value.stock);
        }
      });

      if (loaded.length === 0) {
        setDiscoveryCards([]);
        setDiscoveryError('Live stock prices are unavailable right now.');
      } else {
        setDiscoveryCards(loaded);
        setDiscoveryError('');
      }

      setDiscoveryLoading(false);
    };

    load();

    return () => {
      active = false;
    };
  }, [discoverySymbols, discoveryKey]);

  // ---- Debounced stock search (existing /stocks/search endpoint) ----
  useEffect(() => {
    const trimmed = searchQuery.trim();

    let active = true;

    const timer = setTimeout(async () => {
      if (!active) {
        return;
      }

      if (trimmed.length < SEARCH_MIN_CHARS) {
        setSearchResults([]);
        setSearchError("");
        setSearchLoading(false);
        setSearchOpen(false);
        setHighlightedIndex(-1);
        return;
      }

      setSearchLoading(true);
      setSearchOpen(true);

      try {
        const response = await api.get("/stocks/search", {
          params: { q: trimmed }
        });

        if (!active) {
          return;
        }

        const quotes = Array.isArray(response?.data?.results)
          ? response.data.results
          : [];

        setSearchResults(quotes.slice(0, SEARCH_RESULTS_LIMIT));
        setSearchError("");
        setHighlightedIndex(-1);
      } catch (searchApiError) {
        if (active) {
          setSearchResults([]);
          setSearchError(
            friendlyError(searchApiError, 'Stock search is unavailable right now.')
          );
        }
      } finally {
        if (active) {
          setSearchLoading(false);
        }
      }
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [searchQuery]);

  // ---- Close the search dropdown when clicking outside ----
  useEffect(() => {
    if (!searchOpen) {
      return undefined;
    }

    const handlePointerDown = (event) => {
      if (searchRef.current && !searchRef.current.contains(event.target)) {
        setSearchOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);

    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [searchOpen]);

  // ---- Top movers: derived only from real quote data already loaded ----
  const quoteCandidates = useMemo(() => {
    const bySymbol = new Map();

    [...discoveryCards, ...watchlistStocks].forEach((stock) => {
      const percentChange = Number(stock?.percentChange);

      if (stock?.symbol && !Number.isNaN(percentChange)) {
        bySymbol.set(stock.symbol, stock);
      }
    });

    return Array.from(bySymbol.values());
  }, [discoveryCards, watchlistStocks]);

  const topGainers = useMemo(
    () =>
      quoteCandidates
        .filter((stock) => Number(stock.percentChange) > 0)
        .sort((a, b) => Number(b.percentChange) - Number(a.percentChange))
        .slice(0, 3),
    [quoteCandidates]
  );

  const topLosers = useMemo(
    () =>
      quoteCandidates
        .filter((stock) => Number(stock.percentChange) < 0)
        .sort((a, b) => Number(a.percentChange) - Number(b.percentChange))
        .slice(0, 3),
    [quoteCandidates]
  );

  // ---- Search interaction ----
  const selectSearchResult = (result) => {
    const symbol = result?.symbol;

    if (!symbol) {
      return;
    }

    navigate(`/stock/${encodeURIComponent(symbol)}`);
    setSearchQuery('');
    setSearchResults([]);
    setSearchOpen(false);
    setHighlightedIndex(-1);
    searchInputRef.current?.blur();
  };

  const handleSearchKeyDown = (event) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setSearchOpen(true);
      setHighlightedIndex((current) =>
        Math.min(current + 1, searchResults.length - 1)
      );
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setHighlightedIndex((current) => Math.max(current - 1, -1));
      return;
    }

    if (event.key === 'Escape') {
      setSearchOpen(false);
      return;
    }

    if (event.key === 'Enter') {
      event.preventDefault();

      const highlighted = searchResults[highlightedIndex];

      if (highlighted) {
        selectSearchResult(highlighted);
        return;
      }

      const symbol = searchQuery.trim().toUpperCase();

      if (symbol) {
        navigate(`/stock/${encodeURIComponent(symbol)}`);
        setSearchOpen(false);
        searchInputRef.current?.blur();
      }
    }
  };

  // ---- Trade modal / data refresh ----
  const closeTradeModal = () => setSelectedTrade(null);

  const handleTradeSuccess = () => {
    setSelectedTrade(null);
    setRefreshKey((key) => key + 1);
    refreshMarketQuotes();
    setDiscoveryKey((key) => key + 1);
  };

  const focusSearch = () => {
    searchInputRef.current?.focus();
  };

  // Market overview live-status indicator (dot + label).
  const marketStatusDot = useMemo(() => {
    if (marketStreamStatus === 'connecting') return 'connecting';
    if (marketStreamStatus === 'reconnecting') return 'reconnecting';
    if (marketStreamStatus === 'error') return 'error';
    if (marketSession === 'closed') return 'closed';
    return 'live';
  }, [marketStreamStatus, marketSession]);

  const marketStatusLabel = useMemo(() => {
    if (marketStreamStatus === 'connecting') return 'Connecting…';
    if (marketStreamStatus === 'reconnecting') return 'Reconnecting…';
    if (marketStreamStatus === 'error') return 'Market data unavailable';
    if (marketStreamStatus === 'connected') {
      if (marketSession === 'closed') return 'Market closed';
      if (marketDataSource === 'twelve_data_ws') return 'Live (Twelve Data WS)';
      if (marketDataSource === 'rest_fallback') return 'Connected (REST Fallback)';
      return 'Live';
    }
    return 'Connecting…';
  }, [marketStreamStatus, marketSession, marketDataSource]);

  return (
    <div className="dashboard-app">
      <main className="dashboard-main">
        <section className="page-header">
          <div>
            <p className="eyebrow">Portfolio overview</p>
            <h1>Welcome, {user?.name || 'Investor'}</h1>
            <p className="subtitle">Track your portfolio, discover stocks, and stay on top of the market.</p>
          </div>
        </section>

        {/* ---- Portfolio overview ---- */}
        <section className="stats-grid">
          <div className="stat-card blue">
            <p className="stat-label">Available Cash</p>
            <h3>{overviewLoading ? <span className="skeleton skeleton-line large" /> : formatCurrency(availableCash)}</h3>
          </div>
          <div className="stat-card purple">
            <p className="stat-label">Invested</p>
            <h3>{overviewLoading ? <span className="skeleton skeleton-line large" /> : formatCurrency(portfolioTotals.invested)}</h3>
          </div>
          <div className="stat-card green">
            <p className="stat-label">Portfolio Value</p>
            <h3>{overviewLoading ? <span className="skeleton skeleton-line large" /> : formatCurrency(portfolioTotals.value)}</h3>
          </div>
          <div className={`stat-card ${portfolioTotals.profitLoss >= 0 ? 'positive' : 'negative'}`}>
            <p className="stat-label">Total P&L</p>
            <h3>{overviewLoading ? <span className="skeleton skeleton-line large" /> : formatSignedCurrency(portfolioTotals.profitLoss)}</h3>
            {!overviewLoading && portfolioTotals.profitLoss !== null && portfolioTotals.profitLoss !== undefined ? (
              <p className="stat-trend">{portfolioTotals.profitLoss >= 0 ? '▲' : '▼'} vs cost</p>
            ) : null}
          </div>
        </section>

        {/* ---- Market overview ---- */}
        <section className="dashboard-section" aria-label="Market overview">
          <div className="section-header">
            <h2>Market Overview</h2>
            <div className="market-actions">
              <div className="market-status-wrap">
                <span className={`market-status-dot ${marketStatusDot}`} aria-hidden="true" />
                <span className="market-status-text" aria-live="polite">
                  {marketStatusLabel}
                </span>
                {lastMarketUpdate ? (
                  <span className="market-updated">
                    Last updated: {formatUpdatedTime(lastMarketUpdate)}
                  </span>
                ) : null}
              </div>
              <button
                type="button"
                className="market-refresh"
                onClick={refreshMarketQuotes}
                disabled={marketLoading}
                aria-label="Refresh market data"
                title="Refresh market data"
              >
                <RefreshIcon />
                {marketLoading ? 'Updating…' : 'Refresh'}
              </button>
            </div>
          </div>

          {marketError ? (
            <p className="market-note" role="status">
              {marketError}
            </p>
          ) : null}

          <div className="index-cards">
            {indexes.length > 0 ? (
              indexes.map((index) => (
                <div className="index-card" key={index.symbol}>
                  <p className="index-label">{index.label}</p>
                  <span className="index-value">{formatCurrency(index.currentPrice)}</span>
                  <div className="index-meta">
                    <span className={index.change >= 0 ? 'positive-text' : 'negative-text'}>
                      {formatSignedCurrency(index.change)}
                    </span>
                    <span className={index.percentChange >= 0 ? 'positive-text' : 'negative-text'}>
                      {formatPercent(index.percentChange)}
                    </span>
                  </div>
                </div>
              ))
            ) : marketLoading ? (
              <div className="index-card">
                <span className="skeleton skeleton-line large" />
              </div>
            ) : (
              <div className="index-card">
                <p className="index-label">NIFTY 50 · SENSEX</p>
                <span className="index-value">--</span>
                <p className="empty-note">Market data unavailable</p>
              </div>
            )}
          </div>
        </section>


        {/* ---- Discover stocks ---- */}
        <section className="dashboard-section">
          <div className="section-header">
            <h2>Discover Stocks</h2>
          </div>

          <div className="dashboard-search" ref={searchRef}>
            <form className="search-field" role="search" onSubmit={(event) => event.preventDefault()}>
              <SearchIcon />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                onKeyDown={handleSearchKeyDown}
                placeholder="Search stocks by symbol or company name…"
                aria-label="Search stocks by symbol or company name"
                aria-expanded={searchOpen || undefined}
                aria-autocomplete="list"
                autoComplete="off"
              />
            </form>

            {searchQuery.trim().length >= SEARCH_MIN_CHARS && (searchLoading || searchOpen) && (
              <div className="search-dropdown" role="listbox">
                {searchLoading ? (
                  <p className="search-status">Searching…</p>
                ) : searchError ? (
                  <p className="search-status">{searchError}</p>
                ) : searchResults.length === 0 ? (
                  <p className="search-status">No results found</p>
                ) : (
                  searchResults.map((result, index) => (
                    <button
                      key={result.symbol || index}
                      type="button"
                      className={`search-option ${index === highlightedIndex ? 'highlighted' : ''}`}
                      onMouseDown={(event) => {
                        event.preventDefault();
                        selectSearchResult(result);
                      }}
                      onClick={() => selectSearchResult(result)}
                    >
                      <span className="search-option-symbol">{result.symbol}</span>
                      <span className="search-option-name">{resultName(result)}</span>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          {recentSymbols.length > 0 ? (
            <p className="stat-label" style={{ marginTop: '14px', marginBottom: '8px' }}>Recently viewed</p>
          ) : null}

          {discoveryLoading ? (
            <div className="stock-cards-grid">
              {Array.from({ length: 6 }).map((_, index) => (
                <div className="stock-card" key={`skeleton-${index}`}>
                  <span className="skeleton skeleton-line" />
                  <span className="skeleton skeleton-line medium" />
                  <span className="skeleton skeleton-line medium" />
                </div>
              ))}
            </div>
          ) : discoveryError ? (
            <p className="empty-note">{discoveryError}</p>
          ) : discoveryCards.length === 0 ? (
            <p className="empty-note">No stock data available right now.</p>
          ) : (
            <div className="stock-cards-grid">
              {discoveryCards.map((stock) => (
                <StockCard
                  key={stock.symbol}
                  stock={stock}
                  onClick={() => navigate(`/stock/${encodeURIComponent(stock.symbol)}`)} />
              ))}
            </div>
          )}
        </section>

        {/* ---- Top movers ---- */}
        <section className="dashboard-section">
          <div className="section-header">
            <h2>Top Movers</h2>
            <span className="cell-muted">From your watchlist &amp; discovered stocks</span>
          </div>

          <div className="movers-grid">
            <div className="mover-list">
              {topGainers.length > 0 ? (
                topGainers.map((stock) => (
                  <Link to={`/stock/${encodeURIComponent(stock.symbol)}`} className="mover-row" key={`g-${stock.symbol}`}>
                    <span className="mover-symbol">{stock.symbol}</span>
                    <span className="mover-price">{formatCurrency(stock.currentPrice)}</span>
                    <span className="positive-text">{formatPercent(stock.percentChange)}</span>
                  </Link>
                ))
              ) : (
                <p className="search-status">No gainers at the moment</p>
              )}
            </div>
            <div className="mover-list">
              {topLosers.length > 0 ? (
                topLosers.map((stock) => (
                  <Link to={`/stock/${encodeURIComponent(stock.symbol)}`} className="mover-row" key={`l-${stock.symbol}`}>
                    <span className="mover-symbol">{stock.symbol}</span>
                    <span className="mover-price">{formatCurrency(stock.currentPrice)}</span>
                    <span className="negative-text">{formatPercent(stock.percentChange)}</span>
                  </Link>
                ))
              ) : (
                <p className="search-status">No losers at the moment</p>
              )}
            </div>
          </div>
        </section>


        {/* ---- Watchlist preview ---- */}
        <section className="dashboard-section">
          <div className="section-header">
            <h2>Your Watchlist</h2>
            <button type="button" className="text-button" onClick={() => navigate('/watchlist')} disabled={watchlistLoading}>
              <span>View all</span>
              <ArrowRightIcon />
            </button>
          </div>

          {watchlistLoading ? (
            <div className="mover-list">
              {Array.from({ length: 5 }).map((_, index) => (
                <div className="mover-row" key={`wl-skel-${index}`}>
                  <span className="skeleton skeleton-line medium" />
                </div>
              ))}
            </div>
          ) : watchlistError ? (
            <p className="empty-note">{watchlistError}</p>
          ) : watchlistStocks.length === 0 ? (
            <div className="empty-note">
              Your watchlist is empty. Explore and add stocks from Discover.
            </div>
          ) : (
            <div className="dashboard-table-wrapper">
              <table className="preview-table">
                <thead>
                  <tr>
                    <th>Symbol</th>
                    <th>Price</th>
                    <th>Change</th>
                    <th>Change %</th>
                  </tr>
                </thead>
                <tbody>
                  {watchlistStocks.slice(0, PREVIEW_LIMIT).map((stock) => (
                    <tr key={stock.symbol}>
                      <td>
                        <Link to={`/stock/${encodeURIComponent(stock.symbol)}`} className="cell-muted">
                          {stock.symbol}
                        </Link>
                      </td>
                      <td className="cell-muted">{formatCurrency(stock.currentPrice)}</td>
                      <td className={stock.change >= 0 ? 'positive-text' : 'negative-text'}>
                        {formatSignedCurrency(stock.change)}
                      </td>
                      <td className={stock.percentChange >= 0 ? 'positive-text' : 'negative-text'}>
                        {formatPercent(stock.percentChange)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* ---- Portfolio preview ---- */}
        <section className="dashboard-section">
          <div className="section-header">
            <h2>Your Portfolio</h2>
            <button type="button" className="text-button" onClick={() => navigate('/portfolio')}>
              <span>View all</span>
              <ArrowRightIcon />
            </button>
          </div>

          {overviewLoading ? (
            <div className="mover-list">
              {Array.from({ length: 5 }).map((_, index) => (
                <div className="mover-row" key={`pf-skel-${index}`}>
                  <span className="skeleton skeleton-line medium" />
                </div>
              ))}
            </div>
          ) : holdings.length === 0 ? (
            <div className="empty-note">
              You have no holdings yet. Search a stock above and place your first trade.
            </div>
          ) : (
            <div className="dashboard-table-wrapper">
              <table className="preview-table">
                <thead>
                  <tr>
                    <th>Symbol</th>
                    <th>Qty</th>
                    <th>Current Price</th>
                    <th>P&L</th>
                  </tr>
                </thead>
                <tbody>
                  {holdings.slice(0, PREVIEW_LIMIT).map((holding) => {
                    const current = Number(holding.currentPrice);
                    const owned = Number(holding.quantity);
                    const avg = Number(holding.averageBuyPrice);
                    const pl = Number.isNaN(current) || Number.isNaN(owned) || Number.isNaN(avg)
                      ? null
                      : current * owned - avg * owned;

                    return (
                      <tr key={holding.symbol}>
                        <td>
                          <Link to={`/stock/${encodeURIComponent(holding.symbol)}`} className="cell-muted">
                            {holding.symbol}
                          </Link>
                        </td>
                        <td className="cell-muted">{owned}</td>
                        <td className="cell-muted">{formatCurrency(current)}</td>
                        <td className={pl === null ? 'cell-muted' : pl >= 0 ? 'positive-text' : 'negative-text'}>
                          {pl === null ? '--' : formatSignedCurrency(pl)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>


        {/* ---- Recent orders ---- */}
        <section className="dashboard-section">
          <div className="section-header">
            <h2>Recent Orders</h2>
            <button type="button" className="text-button" onClick={() => navigate('/orders')}>
              <span>View all</span>
              <ArrowRightIcon />
            </button>
          </div>

          {ordersLoading ? (
            <div className="mover-list">
              {Array.from({ length: 5 }).map((_, index) => (
                <div className="mover-row" key={`order-skel-${index}`}>
                  <span className="skeleton skeleton-line medium" />
                </div>
              ))}
            </div>
          ) : ordersError ? (
            <p className="empty-note">{ordersError}</p>
          ) : recentOrders.length === 0 ? (
            <div className="empty-note">
              You have no recent orders. Place a buy or sell to get started.
            </div>
          ) : (
            <div className="dashboard-table-wrapper">
              <table className="preview-table">
                <thead>
                  <tr>
                    <th>Side</th>
                    <th>Symbol</th>
                    <th>Qty</th>
                    <th>Price</th>
                    <th>Status</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {recentOrders.map((order) => (
                    <tr key={order._id || order.id || order.symbol}>
                      <td>
                        <span className={`order-badge badge-${orderSide(order) === 'BUY' ? 'buy' : 'sell'}`}>
                          {orderSide(order)}
                        </span>
                      </td>
                      <td>
                        <Link to={`/stock/${encodeURIComponent(order.symbol)}`} className="cell-muted">
                          {order.symbol}
                        </Link>
                      </td>
                      <td className="cell-muted">{Number(order.quantity)}</td>
                      <td className="cell-muted">{formatCurrency(order.price)}</td>
                      <td>
                        <span className={`order-status-badge status-${orderStatusClass(order.status)}`}>
                          {order.status}
                        </span>
                      </td>
                      <td className="cell-muted">{formatDate(order.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* ---- Quick actions ---- */}
        <section className="dashboard-section">
          <h2 style={{ marginTop: 0 }}>Quick Actions</h2>
          <div className="quick-actions">
            <button type="button" className="quick-action" onClick={focusSearch}>
              <SearchIcon />
              <span>Search Stocks</span>
            </button>
            <Link to="/portfolio" className="quick-action">
              <RefreshIcon />
              <span>View Portfolio</span>
            </Link>
            <Link to="/watchlist" className="quick-action">
              <ArrowRightIcon />
              <span>View Watchlist</span>
            </Link>
            <Link to="/account" className="quick-action">
              <ArrowRightIcon />
              <span>Add Funds</span>
            </Link>
          </div>
        </section>

        {/* ---- Trade modal ---- */}
        {selectedTrade && (
          <TradeModal
            isOpen={true}
            mode={selectedTrade.mode}
            stock={selectedTrade.stock}
            availableCash={availableCash}
            onClose={closeTradeModal}
            onRefresh={handleTradeSuccess}
          />
        )}
      </main>
    </div>
  );
};

export default Dashboard;
