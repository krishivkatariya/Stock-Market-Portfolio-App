import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import api from '../api/api';
import TradeModal from '../components/TradeModal';
import { useAuth } from '../context/useAuth';
import { subscribeToMarketSymbols } from '../services/marketStreamService';

const formatCurrency = (value) => {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return 'Ã¢â€šÂ¹0.00';
  }

  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2
  }).format(Number(value));
};

const formatSignedCurrency = (value) => {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return 'Ã¢â€šÂ¹0.00';
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
  const { logout } = useAuth();

  const [account, setAccount] = useState(null);
  const [portfolio, setPortfolio] = useState(null);
  const [loading, setLoading] = useState(true);
  const [accountLoading, setAccountLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedTrade, setSelectedTrade] = useState(null);
  const [tradeMode, setTradeMode] = useState('buy');
  const [holdingsFilter, setHoldingsFilter] = useState('');
  const [holdingsSort, setHoldingsSort] = useState('currentValue');

  // Live price overrides keyed by symbol.
  // When a WS/REST event arrives, the current market price is updated here
  // without touching the DB-sourced portfolio data (quantity, avg price, etc.)
  const [livePrices, setLivePrices] = useState({});

  // Stream connection status for the indicator.
  const [streamStatus, setStreamStatus] = useState('connecting');
  const [streamSession, setStreamSession] = useState(null);
  const [lastLiveUpdate, setLastLiveUpdate] = useState(null);
  // Dominant data source: 'twelve_data_ws' if any holding has live ticks,
  // otherwise 'rest_fallback'.
  const [liveDataSource, setLiveDataSource] = useState(null);

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

  // ---- Live price stream ----
  // Subscribe to all holding symbols so their current prices update in real
  // time whenever fresh market data arrives (WS or REST fallback).
  // Only recalculates when the portfolio's symbol set changes.
  const holdingSymbols = useMemo(
    () => (portfolio?.stocks || []).map((s) => s.symbol),
    [portfolio]
  );

  const holdingSymbolsKey = useMemo(
    () => [...holdingSymbols].sort().join(','),
    [holdingSymbols]
  );

  useEffect(() => {
    if (holdingSymbols.length === 0) {
      return undefined;
    }

    let active = true;

    const unsubscribe = subscribeToMarketSymbols(holdingSymbols, {
      onMessage: (data) => {
        if (!active) {
          return;
        }

        const quotes = data?.quotes;

        if (quotes && typeof quotes === 'object') {
          // Track dominant source across holding symbols.
          const wsSupported = holdingSymbols.some(
            (sym) => quotes[sym]?.source === 'twelve_data_ws'
          );
          setLiveDataSource(
            wsSupported ? 'twelve_data_ws' : 'rest_fallback'
          );

          setLivePrices((prev) => {
            const next = { ...prev };
            let changed = false;

            holdingSymbols.forEach((sym) => {
              const live = quotes[sym];
              if (live && live.price !== null && live.price !== undefined) {
                next[sym] = Number(live.price);
                changed = true;
              }
            });

            return changed ? next : prev;
          });

          setLastLiveUpdate(new Date());
        }

        if (data?.marketStatus === 'open' || data?.marketStatus === 'closed') {
          setStreamSession(data.marketStatus);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [holdingSymbolsKey]);

  // Holdings with live market-value calculations applied.
  // DB fields (quantity, averageBuyPrice, investment) are NEVER modified.
  // Only currentPrice, currentValue, and profitLoss are recalculated from
  // live data when available.
  const enrichedHoldings = useMemo(() => {
    return (portfolio?.stocks || []).map((stock) => {
      const livePrice = livePrices[stock.symbol];
      const currentPrice = livePrice !== undefined ? livePrice : Number(stock.currentPrice ?? 0);
      const quantity = Number(stock.quantity ?? 0);
      const investment = Number(stock.investment != null ? stock.investment : (stock.averageBuyPrice != null ? stock.averageBuyPrice * quantity : 0));

      const currentValue = currentPrice * quantity;
      const profitLoss = currentValue - investment;

      return {
        ...stock,
        currentPrice,
        currentValue,
        profitLoss
      };
    });
  }, [portfolio, livePrices]);

  // Recalculate portfolio-level totals from enriched holdings.
  const liveTotals = useMemo(() => {
    if (enrichedHoldings.length === 0) {
      return {
        totalInvestment: Number(portfolio?.totalInvestment ?? 0),
        totalPortfolioValue: Number(portfolio?.totalPortfolioValue ?? 0),
        totalProfitLoss: Number(portfolio?.totalProfitLoss ?? 0)
      };
    }

    const totalInvestment = enrichedHoldings.reduce(
      (sum, s) => sum + Number(s.investment ?? 0),
      0
    );
    const totalPortfolioValue = enrichedHoldings.reduce(
      (sum, s) => sum + Number(s.currentValue ?? 0),
      0
    );
    const totalProfitLoss = totalPortfolioValue - totalInvestment;

    return { totalInvestment, totalPortfolioValue, totalProfitLoss };
  }, [enrichedHoldings, portfolio]);

  const displayHoldings = useMemo(() => {
    const query = holdingsFilter.trim().toLowerCase();
    return [...enrichedHoldings]
      .filter((stock) => !query || `${stock.symbol} ${stock.companyName || ''}`.toLowerCase().includes(query))
      .sort((left, right) => {
        if (holdingsSort === 'pnl') return Number(right.profitLoss || 0) - Number(left.profitLoss || 0);
        if (holdingsSort === 'pnlPercent') {
          const leftPercent = Number(left.averageBuyPrice) ? ((Number(left.currentPrice) - Number(left.averageBuyPrice)) / Number(left.averageBuyPrice)) * 100 : 0;
          const rightPercent = Number(right.averageBuyPrice) ? ((Number(right.currentPrice) - Number(right.averageBuyPrice)) / Number(right.averageBuyPrice)) * 100 : 0;
          return rightPercent - leftPercent;
        }
        if (holdingsSort === 'investment') return Number(right.investment || 0) - Number(left.investment || 0);
        if (holdingsSort === 'quantity') return Number(right.quantity || 0) - Number(left.quantity || 0);
        return Number(right.currentValue || 0) - Number(left.currentValue || 0);
      });
  }, [enrichedHoldings, holdingsFilter, holdingsSort]);

  const totalProfitPercent = liveTotals.totalInvestment > 0
    ? (liveTotals.totalProfitLoss / liveTotals.totalInvestment) * 100
    : null;

  // Live status indicator label.
  const liveStatusLabel = useMemo(() => {
    if (streamStatus === 'connecting') return 'ConnectingÃ¢â‚¬Â¦';
    if (streamStatus === 'reconnecting') return 'ReconnectingÃ¢â‚¬Â¦';
    if (streamStatus === 'error') return 'Market data unavailable';
    if (streamStatus === 'connected') {
      if (streamSession === 'closed') return 'Market closed';
      if (liveDataSource === 'twelve_data_ws') return 'Live (Twelve Data WS)';
      if (liveDataSource === 'rest_fallback') return 'Connected (REST Fallback)';
      return 'Live';
    }
    return 'ConnectingÃ¢â‚¬Â¦';
  }, [streamStatus, streamSession, liveDataSource]);

  const liveStatusDot = useMemo(() => {
    if (streamStatus === 'connecting') return 'connecting';
    if (streamStatus === 'reconnecting') return 'reconnecting';
    if (streamStatus === 'error') return 'error';
    if (streamSession === 'closed') return 'closed';
    return 'live';
  }, [streamStatus, streamSession]);

  const summaryCards = useMemo(() => {
    const availableCash = Number(account?.availableCash ?? 0);
    const { totalInvestment, totalPortfolioValue, totalProfitLoss } = liveTotals;

    return [
      {
        title: 'Total Investment',
        value: formatCurrency(totalInvestment),
        tone: 'purple',
        subtitle: 'Capital deployed'
      },
      {
        title: 'Current Portfolio Value',
        value: formatCurrency(totalPortfolioValue),
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
        title: 'P&L Percentage',
        value: totalProfitPercent === null ? '—' : formatPercent(totalProfitPercent),
        tone: totalProfitPercent === null || totalProfitPercent >= 0 ? 'positive' : 'negative',
        subtitle: 'Since invested'
      },
      {
        title: "Today's P&L",
        value: '—',
        tone: 'neutral',
        subtitle: 'Provider data unavailable'
      },
      {
        title: 'Available Cash',
        value: formatCurrency(availableCash),
        tone: 'blue',
        subtitle: 'Ready to invest'
      }
    ];
  }, [account, liveTotals, totalProfitPercent]);

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

  return (
    <div className="dashboard-app">
      <main className="dashboard-main">
        <section className="page-header">
          <div>
            <p className="eyebrow">Portfolio</p>
            <h1>My Portfolio</h1>
            <p className="subtitle">Monitor positions, cash balance, and trading activity.</p>
          </div>
          {/* Live status indicator */}
          <div className="market-status-wrap" style={{ marginTop: '8px' }}>
            <span className={`market-status-dot ${liveStatusDot}`} aria-hidden="true" />
            <span className="market-status-text" aria-live="polite">
              {liveStatusLabel}
            </span>
            {lastLiveUpdate ? (
              <span className="market-updated">
                Last updated: {formatUpdatedTime(lastLiveUpdate)}
              </span>
            ) : null}
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
            <div className="holdings-tools">
              <input
                type="search"
                value={holdingsFilter}
                onChange={(event) => setHoldingsFilter(event.target.value)}
                placeholder="Filter holdings"
                aria-label="Filter holdings"
              />
              <select value={holdingsSort} onChange={(event) => setHoldingsSort(event.target.value)} aria-label="Sort holdings">
                <option value="currentValue">Sort: Current value</option>
                <option value="investment">Sort: Invested value</option>
                <option value="pnl">Sort: P&amp;L</option>
                <option value="pnlPercent">Sort: P&amp;L %</option>
                <option value="quantity">Sort: Quantity</option>
              </select>
            </div>
          </div>

          {loading || accountLoading ? (
            <div className="inline-loading">Loading portfolio...</div>
          ) : error ? (
            <div className="inline-error">{error}</div>
          ) : enrichedHoldings.length === 0 ? (
            <div className="empty-state">
              <p>No stocks in your portfolio yet.</p>
              <button type="button" className="primary-button inline-action-button" onClick={() => navigate('/dashboard')}>
                Explore Stocks
              </button>
            </div>
          ) : displayHoldings.length === 0 ? (
            <div className="empty-notes">No holdings match this filter.</div>
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
                  {displayHoldings.map((stock) => {
                    const totalProfitLoss = Number(stock.profitLoss ?? 0);
                    const percentChange =
                      stock.averageBuyPrice && Number(stock.averageBuyPrice) > 0
                        ? ((Number(stock.currentPrice ?? 0) - Number(stock.averageBuyPrice)) / Number(stock.averageBuyPrice)) * 100
                        : 0;

                    return (
                      <tr key={stock.symbol}>
                        <td>
                          <Link to={`/stock/${stock.symbol}`} className="stock-symbol-link">
                            {stock.symbol}
                          </Link>
                        </td>
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
