import { useCallback, useEffect, useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';

import { useAuth } from '../context/useAuth';
import {
  getWatchlist,
  removeFromWatchlist
} from '../services/watchlistService';

const formatCurrency = (value) => {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return '₹0.00';
  }

  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2
  }).format(Number(value));
};

const formatSignedCurrency = (value) => {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return '₹0.00';
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
  const { user, logout } = useAuth();

  const [stocks, setStocks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [removingSymbol, setRemovingSymbol] = useState('');
  const [message, setMessage] = useState('');

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

  return (
<div className="dashboard-app">
      <nav className="topbar">
        <div className="brand-wrap">
          <div className="brand-icon">₹</div>
          <div>
            <div className="brand-name">Stock Market Portfolio</div>
          </div>
        </div>

        <div className="nav-links">
          <NavLink
            to="/dashboard"
            className={({ isActive }) =>
              `nav-link ${isActive ? 'active' : ''}`
            }
          >
            Dashboard
          </NavLink>
          <NavLink
            to="/portfolio"
            className={({ isActive }) =>
              `nav-link ${isActive ? 'active' : ''}`
            }
          >
            Portfolio
          </NavLink>
          <NavLink
            to="/watchlist"
            className={({ isActive }) =>
              `nav-link ${isActive ? 'active' : ''}`
            }
          >
            Watchlist
          </NavLink>
          <NavLink
            to="/orders"
            className={({ isActive }) =>
              `nav-link ${isActive ? 'active' : ''}`
            }
          >
            Orders
          </NavLink>
          <NavLink
            to="/transactions"
            className={({ isActive }) =>
              `nav-link ${isActive ? 'active' : ''}`
            }
          >
            Transactions
          </NavLink>
          <NavLink
            to="/account"
            className={({ isActive }) =>
              `nav-link ${isActive ? 'active' : ''}`
            }
          >
            Account
          </NavLink>
          <NavLink
            to="/notifications"
            className={({ isActive }) =>
              `nav-link ${isActive ? 'active' : ''}`
            }
          >
            Notifications
          </NavLink>
        </div>

        <div className="topbar-user">
          <span>{user?.name || 'Investor'}</span>
          <button
            type="button"
            className="logout-button"
            onClick={logout}
          >
            Logout
          </button>
        </div>
      </nav>

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

            <button
              type="button"
              className="primary-button watchlist-add-button"
              onClick={() => navigate('/dashboard')}
            >
              Add Stocks
            </button>
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