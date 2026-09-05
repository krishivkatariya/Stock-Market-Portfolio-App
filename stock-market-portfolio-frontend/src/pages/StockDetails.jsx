import { useCallback, useEffect, useId, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import api from '../api/api';
import TradeModal from '../components/TradeModal';
import { addRecentStock } from '../utils/recentStocks';
import { useAuth } from '../context/useAuth';
import {
  getStockQuote,
  getStockHistory
} from '../services/stockService';
import { addToWatchlist } from '../services/watchlistService';
import { subscribeToMarketSymbols } from '../services/marketStreamService';

const currencyFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 2
});

const compactNumberFormatter = new Intl.NumberFormat('en-IN', {
  notation: 'compact',
  maximumFractionDigits: 2
});

const formatCurrency = (value) => {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return '₹0.00';
  }

  return currencyFormatter.format(Number(value));
};

const formatSignedCurrency = (value) => {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return '₹0.00';
  }

  return `${value >= 0 ? '+' : '-'}${currencyFormatter.format(Math.abs(Number(value)))}`;
};

const formatPercent = (value) => {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return '0.00%';
  }

  return `${Number(value).toFixed(2)}%`;
};

const formatCompactNumber = (value) => {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return '0';
  }

  return compactNumberFormatter.format(Number(value));
};

const formatChartDate = (value) => {
  if (!value) {
    return '';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short'
  }).format(date);
};

const formatUpdatedTime = (value) => {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return date.toLocaleTimeString('en-IN', {
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  });
};

const friendlyErrorMessage = (error) => {
  if (error?.response?.status === 401) {
    return 'Your session has expired. Please log in again.';
  }

  if (error?.response?.status === 400) {
    return error.response?.data?.message ||
      'This stock could not be found or the request was invalid.';
  }

  if (error?.response?.status === 404) {
    return error.response?.data?.message ||
      'This stock could not be found.';
  }

  if (error?.request) {
    return 'Unable to reach the server. Please check your connection and try again.';
  }

  return error.response?.data?.message ||
    'Something went wrong. Please try again.';
};

const RANGE_OPTIONS = [
  { label: '7D', value: 7 },
  { label: '30D', value: 30 },
  { label: '90D', value: 90 },
  { label: '6M', value: 180 },
  { label: '1Y', value: 365 }
];

// Lightweight, dependency-free SVG line chart of closing prices.
const PriceChart = ({ data }) => {
  const gradientId = `price-area-${useId().replace(/:/g, '')}`;
  const points = data || [];
  const width = 640;
  const height = 280;
  const padX = 14;
  const padTop = 18;
  const padBottom = 30;
  const plotW = width - padX * 2;
  const plotH = height - padTop - padBottom;

  if (points.length === 0) {
    return null;
  }

  const closes = points.map((point) => Number(point.close));
  const minClose = Math.min(...closes);
  const maxClose = Math.max(...closes);
  const rawRange = maxClose - minClose || 1;
  const minPadded = minClose - rawRange * 0.08;
  const maxPadded = maxClose + rawRange * 0.08;
  const span = maxPadded - minPadded;

  const toX = (index) =>
    padX + (points.length === 1
      ? plotW / 2
      : (index / (points.length - 1)) * plotW);
  const toY = (value) =>
    padTop + (1 - (Number(value) - minPadded) / span) * plotH;

  const linePoints = points
    .map((point, index) => `${toX(index)},${toY(point.close)}`)
    .join(' ');

  const firstClose = Number(points[0].close);
  const lastClose = Number(points[points.length - 1].close);
  const isUp = lastClose >= firstClose;
  const lineColor = isUp ? '#16a34a' : '#dc2626';

  const yDivisions = 4;
  const gridLinesY = [];
  for (let i = 0; i <= yDivisions; i += 1) {
    const value = minPadded + (span * i) / yDivisions;
    gridLinesY.push({
      y: toY(value),
      label: currencyFormatter.format(value).replace(/\.00$/, '')
    });
  }

  const labelIndexes = [0, Math.floor((points.length - 1) / 2), points.length - 1];

  return (
    <svg
      className="price-chart"
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label="Historical closing price chart"
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={lineColor} stopOpacity="0.25" />
          <stop offset="100%" stopColor={lineColor} stopOpacity="0.02" />
        </linearGradient>
      </defs>

      {gridLinesY.map((line) => (
        <g key={`grid-${line.y}`}>
          <line
            x1={padX}
            y1={line.y}
            x2={width - padX}
            y2={line.y}
            className="chart-grid-line"
          />
          <text x={padX} y={line.y - 4} className="chart-y-label">
            {line.label}
          </text>
        </g>
      ))}

      {points.length > 1 ? (
        <polygon
          points={`${padX},${padTop + plotH} ${linePoints} ${width - padX},${padTop + plotH}`}
          fill={`url(#${gradientId})`}
        />
      ) : null}

      <polyline
        points={linePoints}
        fill="none"
        stroke={lineColor}
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
      />

      {labelIndexes.map((index) => (
        <text
          key={`xlabel-${index}`}
          x={toX(index)}
          y={height - 8}
          textAnchor={index === 0 ? 'start' : index === points.length - 1 ? 'end' : 'middle'}
          className="chart-x-label"
        >
          {formatChartDate(points[index].date)}
        </text>
      ))}
    </svg>
  );
};
const StockDetails = () => {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const { symbol } = useParams();

  const [stock, setStock] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [range, setRange] = useState(30);
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyError, setHistoryError] = useState('');

  const [availableCash, setAvailableCash] = useState(0);
  const [ownedQuantity, setOwnedQuantity] = useState(0);

  const [tradeState, setTradeState] = useState(null);

  const [addingToWatchlist, setAddingToWatchlist] = useState(false);
  const [inWatchlist, setInWatchlist] = useState(false);
  const [watchlistMessage, setWatchlistMessage] = useState('');
  const [watchlistError, setWatchlistError] = useState('');

    // Live quote stream (shared marketStreamService, no new EventSource here).
  const [streamStatus, setStreamStatus] = useState('connecting');
  const [streamSession, setStreamSession] = useState(null); // 'open' | 'closed' | null
  const [lastLiveUpdate, setLastLiveUpdate] = useState(null);
  const [streamIssue, setStreamIssue] = useState(false);
  // Tracks whether the live price for this symbol came via Twelve Data WS
  // or REST fallback, so the status label can distinguish them.
  const [livePriceSource, setLivePriceSource] = useState(null);

  const fetchQuoteData = useCallback(async () => {
    try {
      const [quoteResponse, accountResponse, portfolioResponse] = await Promise.all([
        getStockQuote(symbol),
        api.get('/account'),
        api.get('/portfolio')
      ]);

      const quoteStock = quoteResponse?.stock || null;
      setStock(quoteStock);

      if (quoteStock?.symbol) {
        addRecentStock(quoteStock.symbol);
      }

      setAvailableCash(Number(accountResponse?.data?.account?.availableCash ?? 0));

      const holdings = portfolioResponse?.data?.portfolio?.stocks || [];
      const holding = holdings.find((item) => item.symbol === (quoteStock?.symbol || symbol));
      setOwnedQuantity(holding ? Number(holding.quantity ?? 0) : 0);
      setError('');
    } catch (fetchError) {
      if (fetchError?.response?.status === 401) {
        logout();
        navigate('/login');
        return;
      }

      setError(friendlyErrorMessage(fetchError));
    } finally {
      setLoading(false);
    }
  }, [symbol, logout, navigate]);

  useEffect(() => {
    let active = true;

    const load = async () => {
      if (!active) {
        return;
      }

      await fetchQuoteData();
    };

    load();

    return () => {
      active = false;
    };
  }, [fetchQuoteData]);

  // ---- Live price stream ----
  // Subscribes only to the current route symbol. When the user navigates
  // AAPL -> MSFT, this effect cleans up the old subscription and subscribes
  // to the new symbol automatically.
  useEffect(() => {
    let active = true;

    const unsubscribe = subscribeToMarketSymbols([symbol], {
      onMessage: (data) => {
        if (!active) {
          return;
        }
        const safeSymbol = String(symbol || '').trim().toUpperCase();
        const quote = data?.quotes?.[safeSymbol];

        // Only apply when the backend actually returned a fresh price
        // (placeholder quotes have price === null and are ignored).
        if (quote && quote.price !== null && quote.price !== undefined) {
          setStock((current) =>
            current
              ? {
                  ...current,
                  currentPrice: quote.price,
                  change: quote.change ?? current.change,
                  percentChange: quote.percentChange ?? current.percentChange
                }
              : current
          );
          setLivePriceSource(quote.source || null);
          setLastLiveUpdate(new Date());
        }

        if (data?.marketStatus === 'open' || data?.marketStatus === 'closed') {
          setStreamSession(data.marketStatus);
        }

        if (data?.status === 'error' || data?.status === 'stale') {
          setStreamIssue(true);
        } else if (data?.status) {
          setStreamIssue(false);
        }
      },
      onStatus: (next) => {
        if (active) {
          setStreamStatus(next);
        }
      }
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [symbol]);

  const fetchHistory = useCallback(async () => {
    try {
      const data = await getStockHistory(symbol, range);
      setHistory(data?.history || []);
      setHistoryError('');
    } catch (fetchError) {
      if (fetchError?.response?.status === 401) {
        logout();
        navigate('/login');
        return;
      }

      setHistoryError(friendlyErrorMessage(fetchError));
    } finally {
      setHistoryLoading(false);
    }
  }, [symbol, range, logout, navigate]);

  useEffect(() => {
    let active = true;

    const load = async () => {
      if (!active) {
        return;
      }

      await fetchHistory();
    };

    load();

    return () => {
      active = false;
    };
  }, [fetchHistory]);

  const handleRetry = () => {
    setLoading(true);
    setError('');
    fetchQuoteData();
  };

  const handleRangeChange = (nextRange) => {
    // fetchHistory re-runs via its useEffect when `range` changes.
    // Calling it directly here would use the stale `range` closure
    // and race with the effect's request.
    setRange(nextRange);
    setHistoryLoading(true);
    setHistoryError('');
  };

  const handleRetryHistory = () => {
    setHistoryLoading(true);
    setHistoryError('');
    fetchHistory();
  };

  const handleAddToWatchlist = async () => {
    if (!stock || addingToWatchlist || inWatchlist) {
      return;
    }

    setAddingToWatchlist(true);
    setWatchlistMessage('');
    setWatchlistError('');

    try {
      await addToWatchlist(stock.symbol);
      setInWatchlist(true);
      setWatchlistMessage(`${stock.symbol} added to your watchlist.`);
    } catch (addError) {
      if (addError?.response?.status === 401) {
        logout();
        navigate('/login');
        return;
      }

      setWatchlistError(
        addError?.response?.data?.message ||
          'Unable to add this stock to your watchlist. Please try again.'
      );
    } finally {
      setAddingToWatchlist(false);
    }
  };

  const openTrade = (mode) => {
    if (!stock) {
      return;
    }

    setTradeState({
      mode,
      stock: {
        symbol: stock.symbol,
        companyName: stock.companyName,
        currentPrice: stock.currentPrice,
        ownedQuantity
      }
    });
  };

  const closeTrade = () => {
    setTradeState(null);
  };

  // Live-status indicator state for the price section.
  const liveStatus = useMemo(() => {
    if (streamStatus === 'connecting') {
      return { dot: 'connecting', label: 'Connecting…' };
    }

    if (streamStatus === 'reconnecting') {
      return { dot: 'reconnecting', label: 'Reconnecting…' };
    }

    if (streamStatus === 'error') {
      return { dot: 'error', label: 'Market data unavailable' };
    }

    if (streamStatus === 'connected') {
      if (streamSession === 'closed') {
        return { dot: 'closed', label: 'Market closed' };
      }

      if (streamIssue) {
        return { dot: 'connecting', label: 'Market data temporarily unavailable' };
      }

      if (livePriceSource === 'twelve_data_ws') {
        return { dot: 'live', label: 'Live (Twelve Data WS)' };
      }

      if (livePriceSource === 'rest_fallback') {
        return { dot: 'live', label: 'Connected (REST Fallback)' };
      }

      return { dot: 'live', label: 'Live' };
    }

    return { dot: 'connecting', label: 'Connecting…' };
  }, [streamStatus, streamSession, streamIssue, livePriceSource]);

  const refreshAfterTrade = useCallback(async () => {
    try {
      const [accountResponse, portfolioResponse] = await Promise.all([
        api.get('/account'),
        api.get('/portfolio')
      ]);

      setAvailableCash(Number(accountResponse?.data?.account?.availableCash ?? 0));

      const holdings = portfolioResponse?.data?.portfolio?.stocks || [];
      const holding = holdings.find((item) => item.symbol === (stock?.symbol || symbol));
      setOwnedQuantity(holding ? Number(holding.quantity ?? 0) : 0);
    } catch (refreshError) {
      if (refreshError?.response?.status === 401) {
        logout();
        navigate('/login');
      }
    }
  }, [stock, symbol, logout, navigate]);

  return (
    <div className="dashboard-app">
      <main className="dashboard-main">
        <section className="page-header stock-details-header">
          <Link to="/dashboard" className="text-button back-link">
            ← Back to Dashboard
          </Link>
          <p className="eyebrow">Stock Details</p>
          <h1>{stock?.symbol || symbol}</h1>
          <p className="subtitle">
            {stock?.companyName || 'Loading company information...'}
          </p>
        </section>

        {loading ? (
          <section className="panel">
            <div className="inline-loading">Loading stock details...</div>
          </section>
        ) : error ? (
          <section className="panel">
            <div className="inline-error">
              {error}
              <button type="button" className="text-button" onClick={handleRetry}>
                Retry
              </button>
            </div>
          </section>
        ) : stock ? (
          <>
            <section className="panel">
              <div className="stock-price-section">
                <h2 className="stock-details-price">
                  {formatCurrency(stock.currentPrice)}
                </h2>
                <span className={Number(stock.change) >= 0 ? 'positive-text' : 'negative-text'}>
                  {formatSignedCurrency(stock.change)} ({formatPercent(stock.percentChange)})
                </span>

                <div className="market-status-wrap">
                  <span className={`market-status-dot ${liveStatus.dot}`} aria-hidden="true" />
                  <span className="market-status-text" aria-live="polite">
                    {liveStatus.label}
                  </span>
                  {lastLiveUpdate ? (
                    <span className="market-updated">
                      Last updated: {formatUpdatedTime(lastLiveUpdate)}
                    </span>
                  ) : null}
                </div>
              </div>

              <div className="stock-details-actions">
                <button
                  type="button"
                  className="primary-button quote-action-button"
                  onClick={() => openTrade('buy')}
                >
                  Buy
                </button>
                <button
                  type="button"
                  className="secondary-button quote-action-button"
                  onClick={() => openTrade('sell')}
                  disabled={ownedQuantity <= 0}
                >
                  Sell
                </button>
                <button
                  type="button"
                  className="warning-button quote-action-button"
                  onClick={handleAddToWatchlist}
                  disabled={addingToWatchlist || inWatchlist}
                >
                  {inWatchlist
                    ? 'In Watchlist ✓'
                    : addingToWatchlist
                      ? 'Adding...'
                      : 'Add to Watchlist'}
                </button>
              </div>

              {watchlistMessage ? (
                <div className="success-message watchlist-inline-message">
                  {watchlistMessage}
                </div>
              ) : null}

              {watchlistError ? (
                <div className="inline-error watchlist-inline-message">
                  {watchlistError}
                </div>
              ) : null}
            </section>

            <section className="panel">
              <div className="panel-header">
                <h2>Price History</h2>
                <div className="chart-range-selector">
                  {RANGE_OPTIONS.map((option) => (
                    <button
                      key={option.label}
                      type="button"
                      className={`range-button ${range === option.value ? 'active' : ''}`}
                      onClick={() => handleRangeChange(option.value)}
                      disabled={historyLoading}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              {historyLoading ? (
                <div className="inline-loading">Loading price history...</div>
              ) : historyError ? (
                <div className="inline-error">
                  {historyError}
                  <button
                    type="button"
                    className="text-button"
                    onClick={handleRetryHistory}
                  >
                    Retry
                  </button>
                </div>
              ) : history.length === 0 ? (
                <div className="empty-notes">
                  No historical data available for this range.
                </div>
              ) : (
                <PriceChart data={history} />
              )}
            </section>

            <section className="panel">
              <div className="panel-header">
                <h2>Market Metrics</h2>
              </div>

              <div className="quote-grid">
                <div className="metric-box">
                  <span>Open</span>
                  <strong>{formatCurrency(stock.open)}</strong>
                </div>
                <div className="metric-box">
                  <span>High</span>
                  <strong>{formatCurrency(stock.high)}</strong>
                </div>
                <div className="metric-box">
                  <span>Low</span>
                  <strong>{formatCurrency(stock.low)}</strong>
                </div>
                <div className="metric-box">
                  <span>Previous Close</span>
                  <strong>{formatCurrency(stock.previousClose)}</strong>
                </div>
                <div className="metric-box">
                  <span>Volume</span>
                  <strong>{formatCompactNumber(stock.volume)}</strong>
                </div>
                <div className="metric-box">
                  <span>Market Cap</span>
                  <strong>{formatCompactNumber(stock.marketCap)}</strong>
                </div>
                <div className="metric-box">
                  <span>Your Shares</span>
                  <strong>{ownedQuantity}</strong>
                </div>
                <div className="metric-box">
                  <span>Available Cash</span>
                  <strong>{formatCurrency(availableCash)}</strong>
                </div>
              </div>
            </section>
          </>
        ) : null}
      </main>

      {tradeState ? (
        <TradeModal
          key={`${tradeState.stock.symbol}-${tradeState.mode}`}
          isOpen
          mode={tradeState.mode}
          stock={tradeState.stock}
          availableCash={availableCash}
          onClose={closeTrade}
          onRefresh={refreshAfterTrade}
        />
      ) : null}
    </div>
  );
};

export default StockDetails;