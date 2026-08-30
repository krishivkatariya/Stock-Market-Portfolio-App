import { useEffect, useMemo, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';

import api from '../api/api';
import { useAuth } from '../context/useAuth';

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

const formatPercent = (value) => {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return '0.00%';
  }

  return `${Number(value).toFixed(2)}%`;
};

const formatSignedCurrency = (value) => {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return '₹0.00';
  }

  return `${value >= 0 ? '+' : '-'}${currencyFormatter.format(Math.abs(Number(value)))}`;
};

const formatCompactNumber = (value) => {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return '0';
  }

  return compactNumberFormatter.format(Number(value));
};

const StatCard = ({ title, value, tone = 'neutral', subtitle }) => (
  <div className={`stat-card ${tone}`}>
    <p className="stat-label">{title}</p>
    <h3>{value}</h3>
    {subtitle ? <span className="stat-subtitle">{subtitle}</span> : null}
  </div>
);

const Navbar = ({ user, onLogout }) => {
  const navItems = [
    { label: 'Dashboard', to: '/dashboard' },
    { label: 'Portfolio', to: '/portfolio' },
    { label: 'Watchlist', to: '/dashboard' },
    { label: 'Transactions', to: '/dashboard' },
    { label: 'Account', to: '/dashboard' }
  ];

  return (
    <nav className="topbar">
      <div className="brand-wrap">
        <div className="brand-icon">₹</div>
        <div>
          <div className="brand-name">Stock Market Portfolio</div>
        </div>
      </div>

      <div className="nav-links">
        {navItems.map((item) => (
          <NavLink
            key={item.label}
            to={item.to}
            className={({ isActive }) =>
              `nav-link ${isActive ? 'active' : ''}`
            }
          >
            {item.label}
          </NavLink>
        ))}
      </div>

      <div className="topbar-user">
        <span>{user?.name || 'Investor'}</span>
        <button type="button" className="logout-button" onClick={onLogout}>
          Logout
        </button>
      </div>
    </nav>
  );
};

const Dashboard = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const [account, setAccount] = useState(null);
  const [portfolio, setPortfolio] = useState(null);
  const [portfolioLoading, setPortfolioLoading] = useState(true);
  const [portfolioError, setPortfolioError] = useState('');

  const [stockQuery, setStockQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');

  const [selectedStock, setSelectedStock] = useState(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [tradeModalStock, setTradeModalStock] = useState(null);

  const fetchDashboardData = async () => {
    try {
      setPortfolioLoading(true);

      const [accountResponse, portfolioResponse] = await Promise.all([
        api.get('/account'),
        api.get('/portfolio')
      ]);

      setAccount(accountResponse.data.account || null);
      setPortfolio(portfolioResponse.data.portfolio || null);
    } catch (error) {
        const message = error.response?.data?.message || 'Unable to load dashboard data.';

        if (error.response?.status === 401) {
          setPortfolioError('Session expired. Please log in again.');
          return;
        }

        setPortfolioError(message);
      } finally {
        setPortfolioLoading(false);
      }
    };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const summaryCards = useMemo(() => {
    const availableCash = Number(account?.availableCash ?? 0);
    const investedAmount = Number(portfolio?.totalInvestment ?? account?.investedAmount ?? 0);
    const portfolioValue = Number(portfolio?.totalPortfolioValue ?? account?.totalPortfolioValue ?? 0);
    const totalProfitLoss = Number(portfolio?.totalProfitLoss ?? portfolioValue - investedAmount);

    return [
      {
        title: 'Available Cash',
        value: formatCurrency(availableCash),
        tone: 'blue',
        subtitle: 'Ready for new investments'
      },
      {
        title: 'Invested Amount',
        value: formatCurrency(investedAmount),
        tone: 'purple',
        subtitle: 'Total capital deployed'
      },
      {
        title: 'Portfolio Value',
        value: formatCurrency(portfolioValue),
        tone: 'green',
        subtitle: 'Current market value'
      },
      {
        title: 'Total Profit/Loss',
        value: formatSignedCurrency(totalProfitLoss),
        tone: totalProfitLoss >= 0 ? 'positive' : 'negative',
        subtitle: totalProfitLoss >= 0 ? 'Gains this cycle' : 'Current drawdown'
      }
    ];
  }, [account, portfolio]);

  const handleSearch = async (event) => {
    event.preventDefault();

    const query = stockQuery.trim();

    if (!query) {
      setSearchError('Please enter a stock symbol or company name.');
      return;
    }

    setSearching(true);
    setSearchError('');

    try {
      const response = await api.get('/stocks/search', {
        params: { q: query }
      });

      const results = response.data?.results || [];

      setSearchResults(results);

      if (!results.length) {
        setSearchError('No stocks matched your search. Try a different keyword.');
      }
    } catch (error) {
      const message = error.response?.data?.message || 'Unable to search stocks right now.';
      setSearchError(message);
    } finally {
      setSearching(false);
    }
  };

  const handleSelectStock = async (stock) => {
    const symbol = stock?.symbol;

    if (!symbol) {
      return;
    }

    setQuoteLoading(true);
    setSearchError('');

    try {
      const response = await api.get(`/stocks/${encodeURIComponent(symbol)}`);
      setSelectedStock(response.data.stock || null);
    } catch (error) {
      const message = error.response?.data?.message || 'Unable to load stock details.';
      setSearchError(message);
      setSelectedStock(null);
    } finally {
      setQuoteLoading(false);
    }
  };

  const holdings = portfolio?.stocks || [];

  const handleOpenTradeModal = (stock) => {
    if (!stock) {
      return;
    }

    setTradeModalStock({
      symbol: stock.symbol,
      companyName: stock.companyName || stock.shortName || stock.longName || stock.symbol,
      currentPrice: stock.currentPrice,
      ownedQuantity: 0
    });
  };

  return (
    <div className="dashboard-app">
      <Navbar user={user} onLogout={logout} />

      <main className="dashboard-main">
        <section className="page-header">
          <div>
            <p className="eyebrow">Portfolio overview</p>
            <h1>Welcome, {user?.name || 'Investor'}</h1>
            <p className="subtitle">Track your portfolio and monitor the market.</p>
          </div>
        </section>

        <section className="stats-grid">
          {summaryCards.map((stat) => (
            <StatCard
              key={stat.title}
              title={stat.title}
              value={stat.value}
              tone={stat.tone}
              subtitle={stat.subtitle}
            />
          ))}
        </section>

        <section className="panel">
          <div className="panel-header">
            <h2>Search Stocks</h2>
          </div>

          <form className="search-form" onSubmit={handleSearch}>
            <input
              type="text"
              value={stockQuery}
              onChange={(event) => setStockQuery(event.target.value)}
              placeholder="Search stocks..."
              aria-label="Search stocks"
            />
            <button type="submit" className="primary-button" disabled={searching}>
              {searching ? 'Searching...' : 'Search'}
            </button>
          </form>

          {searchError ? <div className="inline-error">{searchError}</div> : null}

          <div className="search-results">
            {searchResults.length > 0 ? (
              searchResults.map((stock) => (
                <div key={`${stock.symbol}-${stock.exchange ?? 'market'}`} className="stock-result-card-wrap">
                  <button
                    type="button"
                    className="stock-result-card"
                    onClick={() => handleSelectStock(stock)}
                  >
                  <div className="stock-result-main">
                    <strong>{stock.symbol}</strong>
                    <span>{stock.shortName || stock.longName || 'Company'}</span>
                  </div>
                  <div className="stock-result-meta">
                    <span>{stock.fullExchangeName || stock.exchange || 'N/A'}</span>
                    <span>
                      {stock.regularMarketPrice != null ? formatCurrency(stock.regularMarketPrice) : 'N/A'}
                    </span>
                  </div>
                  </button>
                  <button type="button" className="text-button compact-link" onClick={() => navigate('/portfolio')}>
                    View Portfolio
                  </button>
                </div>
              ))
            ) : (
              <div className="empty-notes">Search for a stock to view available results.</div>
            )}
          </div>
        </section>

        <section className="panel">
          <div className="panel-header">
            <h2>Selected Stock</h2>
          </div>

          {quoteLoading ? (
            <div className="inline-loading">Loading stock...</div>
          ) : selectedStock ? (
            <div className="quote-card">
              <div className="quote-header">
                <div>
                  <div className="quote-symbol">{selectedStock.symbol}</div>
                  <div className="quote-company">{selectedStock.companyName}</div>
                </div>
                <div className="quote-price">{formatCurrency(selectedStock.currentPrice)}</div>
              </div>

              <div className="quote-actions">
                <button type="button" className="primary-button quote-action-button" onClick={() => handleOpenTradeModal(selectedStock)}>
                  Buy {selectedStock.symbol}
                </button>
              </div>

              <div className="quote-grid">
                <div className="metric-box">
                  <span>Open</span>
                  <strong>{formatCurrency(selectedStock.open)}</strong>
                </div>
                <div className="metric-box">
                  <span>High</span>
                  <strong>{formatCurrency(selectedStock.high)}</strong>
                </div>
                <div className="metric-box">
                  <span>Low</span>
                  <strong>{formatCurrency(selectedStock.low)}</strong>
                </div>
                <div className="metric-box">
                  <span>Previous Close</span>
                  <strong>{formatCurrency(selectedStock.previousClose)}</strong>
                </div>
                <div className="metric-box">
                  <span>Change</span>
                  <strong>{formatSignedCurrency(selectedStock.change)}</strong>
                </div>
                <div className="metric-box">
                  <span>% Change</span>
                  <strong>{formatPercent(selectedStock.percentChange)}</strong>
                </div>
                <div className="metric-box">
                  <span>Volume</span>
                  <strong>{formatCompactNumber(selectedStock.volume)}</strong>
                </div>
                <div className="metric-box">
                  <span>Market Cap</span>
                  <strong>{formatCompactNumber(selectedStock.marketCap)}</strong>
                </div>
              </div>
            </div>
          ) : (
            <div className="empty-notes">Select a stock to view the latest quote and market metrics.</div>
          )}
        </section>

        <section className="panel">
          <div className="panel-header">
            <h2>My Portfolio</h2>
          </div>

          {portfolioLoading ? (
            <div className="inline-loading">Loading portfolio...</div>
          ) : portfolioError ? (
            <div className="inline-error">
              {portfolioError}
              <button type="button" className="text-button" onClick={() => window.location.reload()}>
                Retry
              </button>
            </div>
          ) : holdings.length === 0 ? (
            <div className="empty-state">No holdings yet. Search for a stock to begin building your portfolio.</div>
          ) : (
            <div className="table-wrapper">
              <table className="portfolio-table">
                <thead>
                  <tr>
                    <th>Symbol</th>
                    <th>Company</th>
                    <th>Qty</th>
                    <th>Avg Price</th>
                    <th>Current Price</th>
                    <th>Investment</th>
                    <th>Current Value</th>
                    <th>P/L</th>
                  </tr>
                </thead>
                <tbody>
                  {holdings.map((stock) => (
                    <tr key={stock.symbol}>
                      <td>{stock.symbol}</td>
                      <td>{stock.companyName || 'Unknown company'}</td>
                      <td>{stock.quantity}</td>
                      <td>{formatCurrency(stock.averageBuyPrice)}</td>
                      <td>{stock.currentPrice != null ? formatCurrency(stock.currentPrice) : 'N/A'}</td>
                      <td>{formatCurrency(stock.investment)}</td>
                      <td>{stock.currentValue != null ? formatCurrency(stock.currentValue) : 'N/A'}</td>
                      <td className={stock.profitLoss >= 0 ? 'positive-text' : 'negative-text'}>
                        {stock.profitLoss != null ? formatSignedCurrency(stock.profitLoss) : 'N/A'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>

      {tradeModalStock ? (
        <TradeModal
          key={`${tradeModalStock.symbol}-buy`}
          isOpen
          mode="buy"
          stock={tradeModalStock}
          availableCash={Number(account?.availableCash ?? 0)}
          onClose={() => setTradeModalStock(null)}
          onRefresh={fetchDashboardData}
        />
      ) : null}
    </div>
  );
};

export default Dashboard;
