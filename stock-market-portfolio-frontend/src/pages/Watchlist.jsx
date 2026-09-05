import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { useAuth } from '../context/useAuth';
import {
  getWatchlist,
  removeFromWatchlist
} from '../services/watchlistService';
import { subscribeToMarketSymbols } from '../services/marketStreamService';

const formatCurrency = (value) => {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return 'â‚¹0.00';
  }

  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2
  }).format(Number(value));
};

const formatSignedCurrency = (value) => {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return 'â‚¹0.00';
  }

  return `${value >= 0 ? '+' : '-'}${new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2
  }).format(Math.abs(Number(value)))}`;
};

const formatPercent = (value) => {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return '0.00%';
  }

  return `${Number(value).toFixed(2)}%`;
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

  if (error?.response?.status === 404) {
    return error.response?.data?.message ||
      'The watchlist could not be found.';
  }

  if (error?.response?.status === 400) {
    return error.response?.data?.message ||
      'The request could not be completed.';
  }

  if (error?.request) {
    return 'Unable to reach the server. Please check your connection and try again.';
  }

  return error.response?.data?.message ||
    'Something went wrong. Please try again.';
};

const Watchlist = () => {
  const navigate = useNavigate();
  const { logout } = useAuth();

  const [stocks, setStocks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [removingSymbol, setRemovingSymbol] = useState('');
  const [message, setMessage] = useState('');

  // Live stream state (shared marketStreamService).
  const [streamStatus, setStreamStatus] = useState('connecting');
  const [streamSession, setStreamSession] = useState(null); // 'open' | 'closed' | null
  const [lastLiveUpdate, setLastLiveUpdate] = useState(null);
  const [streamIssue, setStreamIssue] = useState(false);
  // Dominant data source for the watchlist: 'twelve_data_ws' if any
  // symbol has live ticks, otherwise 'rest_fallback'.
  const [liveDataSource, setLiveDataSource] = useState(null);

  // Stable key derived from the current watchlist symbol set. It only changes
  // when a symbol is added/removed, so live price updates never churn the SSE
  // subscription.
  const stocksKey = useMemo(
    () => stocks.map((stock) => stock.symbol).sort().join(','),
    [stocks]
  );

  const fetchWatchlist = useCallback(async () => {
    try {
      const data = await getWatchlist();
      setStocks(data?.watchlist || []);
      setError('');
    } catch (loadError) {
      if (loadError?.response?.status === 401) {
        logout();
        navigate('/login');
        return;
      }

      setError(friendlyErrorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }, [logout, navigate]);

  useEffect(() => {
    let active = true;

    const load = async () => {
      if (!active) {
        return;
      }

      await fetchWatchlist();
    };

    load();

    return () => {
      active = false;
    };
  }, [fetchWatchlist]);

  // ---- Live price stream ----
  // Subscribes the current watchlist symbol set to the shared market stream.
  // Re-subscribes only when the set changes (add/remove/reload), so live price
  // updates do not cause connection churn.
  useEffect(() => {
    const currentSymbols = stocksKey ? stocksKey.split(',') : [];
    if (currentSymbols.length === 0) {
      return undefined;
    }

    let active = true;

    const unsubscribe = subscribeToMarketSymbols(currentSymbols, {
      onMessage: (data) => {
        if (!active) {
          return;
        }

        const quotes = data?.quotes;

        if (quotes && typeof quotes === 'object') {
          // Determine dominant source: 'twelve_data_ws' wins if any
          // watchlist symbol has a live WS-derived price.
          const wsSupported = currentSymbols.some(
            (sym) => quotes[sym]?.source === 'twelve_data_ws'
          );
          setLiveDataSource(
            wsSupported ? 'twelve_data_ws' : 'rest_fallback'
          );

          setStocks((current) =>
            current.map((stock) => {
              const live = quotes[stock.symbol];

              // Ignore placeholder frames (price === null) and non-matches.
              if (live && live.price !== null && live.price !== undefined) {
                return {
                  ...stock,
                  currentPrice: live.price,
                  change: live.change ?? stock.change,
                  percentChange: live.percentChange ?? stock.percentChange
                };
              }

              return stock;
            })
          );
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
  }, [stocksKey]);

  const handleRetry = () => {
    setLoading(true);
    setError('');
    setMessage('');
    fetchWatchlist();
  };

  const handleRemove = async (symbol) => {
    if (removingSymbol) {
      return;
    }

    setRemovingSymbol(symbol);
    setError('');
    setMessage('');

    try {
      await removeFromWatchlist(symbol);
      setStocks((current) =>
        current.filter((stock) => stock.symbol !== symbol)
      );
      setMessage(`${symbol} removed from your watchlist.`);
    } catch (removeError) {
      if (removeError?.response?.status === 401) {
        logout();
        navigate('/login');
        return;
      }

      setError(friendlyErrorMessage(removeError));
    } finally {
      setRemovingSymbol('');
    }
  };

  // Live-status indicator state for the watchlist header.
  const liveStatus = useMemo(() => {
    if (streamStatus === 'connecting') {
      return { dot: 'connecting', label: 'Connectingâ€¦' };
    }

    if (streamStatus === 'reconnecting') {
      return { dot: 'reconnecting', label: 'Reconnectingâ€¦' };
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

      if (liveDataSource === 'twelve_data_ws') {
        return { dot: 'live', label: 'Live (Twelve Data WS)' };
      }

      if (liveDataSource === 'rest_fallback') {
        return { dot: 'live', label: 'Connected (REST Fallback)' };
      }

      return { dot: 'live', label: 'Live' };
    }

    return { dot: 'connecting', label: 'Connectingâ€¦' };
  }, [streamStatus, streamSession, streamIssue, liveDataSource]);

  return (
    <div className="dashboard-app">
      <main className="dashboard-main">
        <section className="page-header">
          <div className="watchlist-header-row">
            <div>
              <p className="eyebrow">Portfolio</p>
              <h1>My Watchlist</h1>
              <p className="subtitle">
                Track the stocks you care about at a glance.
              </p>
            </div>

            <div className="watchlist-header-actions">
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

              <button
                type="button"
                className="primary-button watchlist-add-button"
                onClick={() => navigate('/dashboard')}
              >
                Add Stocks
              </button>
            </div>
          </div>
        </section>

        {message ? (
          <div className="success-message watchlist-success">
            {message}
          </div>
        ) : null}

        {loading ? (
          <section className="panel">
            <div className="inline-loading">Loading your watchlist...</div>
          </section>
        ) : error ? (
          <section className="panel">
            <div className="inline-error">
              {error}
              <button
                type="button"
                className="text-button"
                onClick={handleRetry}
              >
                Retry
              </button>
            </div>
          </section>
        ) : stocks.length === 0 ? (
          <section className="panel">
            <div className="empty-state">
              <p>Your watchlist is empty.</p>
              <p>
                Search for a stock and add it to start tracking its price here.
              </p>
              <button
                type="button"
                className="primary-button inline-action-button"
                onClick={() => navigate('/dashboard')}
              >
                Explore Stocks
              </button>
            </div>
          </section>
        ) : (
          <section className="panel">
            <div className="panel-header">
              <h2>Watched Stocks ({stocks.length})</h2>
            </div>

            <div className="table-wrapper">
              <table className="portfolio-table watchlist-table">
                <thead>
                  <tr>
                    <th>Symbol</th>
                    <th>Company</th>
                    <th>Current Price</th>
                    <th>Change</th>
                    <th>% Change</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {stocks.map((stock) => {
                    const change = Number(stock.change ?? 0);
                    const isPositive = change >= 0;

                    return (
                      <tr key={stock.symbol}>
                        <td className="watchlist-symbol">
                          <Link to={`/stock/${stock.symbol}`} className="stock-symbol-link">
                            {stock.symbol}
                          </Link>
                        </td>
                        <td>{stock.companyName || 'Unknown company'}</td>
                        <td>
                          {stock.currentPrice != null
                            ? formatCurrency(stock.currentPrice)
                            : 'N/A'}
                        </td>
                        <td className={isPositive ? 'positive-text' : 'negative-text'}>
                          {stock.change != null
                            ? formatSignedCurrency(stock.change)
                            : 'N/A'}
                        </td>
                        <td className={isPositive ? 'positive-text' : 'negative-text'}>
                          {stock.percentChange != null
                            ? `${isPositive ? '+' : ''}${formatPercent(stock.percentChange)}`
                            : 'N/A'}
                        </td>
                        <td>
                          <button
                            type="button"
                            className="warning-button compact-button"
                            onClick={() => handleRemove(stock.symbol)}
                            disabled={removingSymbol === stock.symbol}
                          >
                            {removingSymbol === stock.symbol
                              ? 'Removing...'
                              : 'Remove'}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </main>
    </div>
  );
};

export default Watchlist;