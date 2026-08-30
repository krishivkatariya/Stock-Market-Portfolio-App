import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import api from '../api/api';
import TradeModal from '../components/TradeModal';
import { useAuth } from '../context/useAuth';

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

const StatCard = ({ title, value, tone = 'neutral', subtitle }) => (
  <div className={`stat-card ${tone}`}>
    <p className="stat-label">{title}</p>
    <h3>{value}</h3>
    {subtitle ? <span className="stat-subtitle">{subtitle}</span> : null}
  </div>
);

const PortfolioPage = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const [account, setAccount] = useState(null);
  const [portfolio, setPortfolio] = useState(null);
  const [loading, setLoading] = useState(true);
  const [accountLoading, setAccountLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedTrade, setSelectedTrade] = useState(null);
  const [tradeMode, setTradeMode] = useState('buy');

  const fetchAccount = useCallback(async () => {
    try {
      setAccountLoading(true);
      const response = await api.get('/account');
      setAccount(response.data.account || null);
    } catch (fetchError) {
      if (fetchError.response?.status === 401) {
        logout();
        navigate('/login');
        return;
      }

      setError(fetchError.response?.data?.message || 'Unable to load account data.');
    } finally {
      setAccountLoading(false);
    }
  }, [logout, navigate]);

  const fetchPortfolio = useCallback(async () => {
    try {
      setLoading(true);
      const response = await api.get('/portfolio');
      setPortfolio(response.data.portfolio || { stocks: [], totalInvestment: 0, totalPortfolioValue: 0, totalProfitLoss: 0 });
      setError('');
    } catch (fetchError) {
      if (fetchError.response?.status === 401) {
        logout();
        navigate('/login');
        return;
      }

      setError(fetchError.response?.data?.message || 'Unable to load portfolio.');
    } finally {
      setLoading(false);
    }
  }, [logout, navigate]);

  const refreshPortfolioData = useCallback(async () => {
    await Promise.all([fetchAccount(), fetchPortfolio()]);
  }, [fetchAccount, fetchPortfolio]);

  useEffect(() => {
    let active = true;

    const loadInitialData = async () => {
      if (!active) {
        return;
      }

      await refreshPortfolioData();
    };

    loadInitialData();

    return () => {
      active = false;
    };
  }, [refreshPortfolioData]);

  const summaryCards = useMemo(() => {
    const availableCash = Number(account?.availableCash ?? 0);
    const investedAmount = Number(portfolio?.totalInvestment ?? account?.investedAmount ?? 0);
    const portfolioValue = Number(portfolio?.totalPortfolioValue ?? account?.totalPortfolioValue ?? 0);
    const totalProfitLoss = Number(portfolio?.totalProfitLoss ?? portfolioValue - investedAmount);

    return [
      {
        title: 'Total Investment',
        value: formatCurrency(investedAmount),
        tone: 'purple',
        subtitle: 'Capital deployed'
      },
      {
        title: 'Current Portfolio Value',
        value: formatCurrency(portfolioValue),
        tone: 'green',
        subtitle: 'Current market value'
      },
      {
        title: 'Total Profit/Loss',
        value: formatSignedCurrency(totalProfitLoss),
        tone: totalProfitLoss >= 0 ? 'positive' : 'negative',
        subtitle: totalProfitLoss >= 0 ? 'Gains' : 'Drawdown'
      },
      {
        title: 'Available Cash',
        value: formatCurrency(availableCash),
        tone: 'blue',
        subtitle: 'Ready to invest'
      }
    ];
  }, [account, portfolio]);

  const holdings = portfolio?.stocks || [];

  const handleOpenTrade = (stock, mode) => {
    const normalizedStock = {
      symbol: stock.symbol,
      companyName: stock.companyName,
      currentPrice: stock.currentPrice,
      ownedQuantity: stock.quantity,
      quantity: stock.quantity
    };

    setTradeMode(mode);
    setSelectedTrade(normalizedStock);
  };

  const closeTradeModal = () => setSelectedTrade(null);

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
          <button type="button" className="nav-link-button" onClick={() => navigate('/dashboard')}>
            Dashboard
          </button>
          <button type="button" className="nav-link-button active" onClick={() => navigate('/portfolio')}>
            Portfolio
          </button>
          <button type="button" className="nav-link-button" onClick={() => navigate('/watchlist')}>
            Watchlist
          </button>
        </div>

        <div className="topbar-user">
          <span>{user?.name || 'Investor'}</span>
          <button type="button" className="logout-button" onClick={logout}>
            Logout
          </button>
        </div>
      </nav>

      <main className="dashboard-main">
        <section className="page-header">
          <div>
            <p className="eyebrow">Portfolio</p>
            <h1>My Portfolio</h1>
            <p className="subtitle">Monitor positions, cash balance, and trading activity.</p>
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
            <h2>Holdings</h2>
          </div>

          {loading || accountLoading ? (
            <div className="inline-loading">Loading portfolio...</div>
          ) : error ? (
            <div className="inline-error">{error}</div>
          ) : holdings.length === 0 ? (
            <div className="empty-state">
              <p>No stocks in your portfolio yet.</p>
              <button type="button" className="primary-button inline-action-button" onClick={() => navigate('/dashboard')}>
                Explore Stocks
              </button>
            </div>
          ) : (
            <div className="table-wrapper">
              <table className="portfolio-table">
                <thead>
                  <tr>
                    <th>Symbol</th>
                    <th>Company</th>
                    <th>Quantity</th>
                    <th>Avg Price</th>
                    <th>Current Price</th>
                    <th>Investment</th>
                    <th>Current Value</th>
                    <th>P/L</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {holdings.map((stock) => {
                    const totalProfitLoss = Number(stock.profitLoss ?? 0);
                    const percentChange =
                      stock.averageBuyPrice && Number(stock.averageBuyPrice) > 0
                        ? ((Number(stock.currentPrice ?? 0) - Number(stock.averageBuyPrice)) / Number(stock.averageBuyPrice)) * 100
                        : 0;

                    return (
                      <tr key={stock.symbol}>
                        <td>{stock.symbol}</td>
                        <td>{stock.companyName || 'Unknown company'}</td>
                        <td>{stock.quantity}</td>
                        <td>{formatCurrency(stock.averageBuyPrice)}</td>
                        <td>{stock.currentPrice != null ? formatCurrency(stock.currentPrice) : 'N/A'}</td>
                        <td>{formatCurrency(stock.investment)}</td>
                        <td>{stock.currentValue != null ? formatCurrency(stock.currentValue) : 'N/A'}</td>
                        <td className={totalProfitLoss >= 0 ? 'positive-text' : 'negative-text'}>
                          <div>{stock.profitLoss != null ? formatSignedCurrency(stock.profitLoss) : 'N/A'}</div>
                          {stock.profitLoss != null ? <small>{formatPercent(percentChange)}</small> : null}
                        </td>
                        <td>
                          <div className="trade-actions-cell">
                            <button type="button" className="secondary-button compact-button" onClick={() => handleOpenTrade(stock, 'buy')}>
                              Buy
                            </button>
                            <button type="button" className="warning-button compact-button" onClick={() => handleOpenTrade(stock, 'sell')}>
                              Sell
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>

      {selectedTrade ? (
        <TradeModal
          key={`${selectedTrade.symbol}-${tradeMode}`}
          isOpen={Boolean(selectedTrade)}
          mode={tradeMode}
          stock={selectedTrade}
          availableCash={Number(account?.availableCash ?? 0)}
          onClose={closeTradeModal}
          onRefresh={refreshPortfolioData}
        />
      ) : null}
    </div>
  );
};

export default PortfolioPage;
