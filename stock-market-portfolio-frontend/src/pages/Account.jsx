import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { useAuth } from '../context/useAuth';
import {
  getAccountSummary,
  getWalletTransactions,
  depositMoney,
  withdrawMoney
} from '../services/accountService';

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

const formatDateTime = (value) => {
  if (!value) {
    return 'N/A';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return 'N/A';
  }

  return new Intl.DateTimeFormat('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(date);
};

const friendlyErrorMessage = (error) => {
  if (error?.response?.status === 401) {
    return 'Your session has expired. Please log in again.';
  }

  if (error?.response?.status === 404) {
    return error.response?.data?.message ||
      'The account could not be found.';
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

const StatCard = ({ title, value, tone = 'neutral', subtitle }) => (
  <div className={`stat-card ${tone}`}>
    <p className="stat-label">{title}</p>
    <h3>{value}</h3>
    {subtitle ? <span className="stat-subtitle">{subtitle}</span> : null}
  </div>
);

const Account = () => {
  const navigate = useNavigate();
  const { logout } = useAuth();

  const [summary, setSummary] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [depositAmount, setDepositAmount] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [action, setAction] = useState('');
  const [actionError, setActionError] = useState('');
  const [actionMessage, setActionMessage] = useState('');

  const loadAccountData = useCallback(async () => {
    try {
      const [summaryResponse, transactionsResponse] = await Promise.all([
        getAccountSummary(),
        getWalletTransactions()
      ]);

      setSummary(summaryResponse.summary || null);
      setTransactions(transactionsResponse.transactions || []);
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

      await loadAccountData();
    };

    load();

    return () => {
      active = false;
    };
  }, [loadAccountData]);

  const handleRetry = () => {
    setLoading(true);
    setError('');
    loadAccountData();
  };

  const validateAmount = (amount) => {
    const parsed = Number(amount);

    if (!amount || !Number.isFinite(parsed) || parsed <= 0) {
      return 'Please enter a positive amount.';
    }

    return '';
  };

  const handleDeposit = async (event) => {
    event.preventDefault();

    const validationError = validateAmount(depositAmount);

    if (validationError) {
      setActionError(validationError);
      setActionMessage('');
      return;
    }

    setAction('deposit');
    setActionError('');
    setActionMessage('');

    try {
      const response = await depositMoney(Number(depositAmount));
      setActionMessage(response.message || 'Deposit successful.');
      setDepositAmount('');
      await loadAccountData();
    } catch (actionFail) {
      if (actionFail?.response?.status === 401) {
        logout();
        navigate('/login');
        return;
      }

      setActionMessage('');
      setActionError(friendlyErrorMessage(actionFail));
    } finally {
      setAction('');
    }
  };

  const handleWithdraw = async (event) => {
    event.preventDefault();

    const validationError = validateAmount(withdrawAmount);

    if (validationError) {
      setActionError(validationError);
      setActionMessage('');
      return;
    }

    const parsed = Number(withdrawAmount);
    const availableCash = Number(summary?.availableCash ?? 0);

    if (parsed > availableCash) {
      setActionError('Withdrawal amount exceeds your available cash.');
      setActionMessage('');
      return;
    }

    setAction('withdraw');
    setActionError('');
    setActionMessage('');

    try {
      const response = await withdrawMoney(parsed);
      setActionMessage(response.message || 'Withdrawal successful.');
      setWithdrawAmount('');
      await loadAccountData();
    } catch (actionFail) {
      if (actionFail?.response?.status === 401) {
        logout();
        navigate('/login');
        return;
      }

      setActionMessage('');
      setActionError(friendlyErrorMessage(actionFail));
    } finally {
      setAction('');
    }
  };

  const accountMode = summary?.accountMode || 'SIMULATION';

  return (
<div className="dashboard-app">
      <main className="dashboard-main">
        <section className="page-header">
          <div className="account-header-row">
            <div>
              <p className="eyebrow">Account</p>
              <h1>Wallet and Account</h1>
              <p className="subtitle">
                Manage your cash balance and review wallet activity.
              </p>
            </div>
            <span className={accountMode === 'SIMULATION' ? 'account-mode-badge mode-simulation' : 'account-mode-badge mode-live'}>
              {accountMode}
            </span>
          </div>
        </section>

        {loading ? (
          <section className="panel">
            <div className="inline-loading">Loading your account...</div>
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
        ) : (
          <div className="account-content">

            <section className="stats-grid">
              <StatCard
                title="Available Cash"
                value={formatCurrency(summary?.availableCash)}
                tone="blue"
                subtitle="Ready to invest"
              />
              <StatCard
                title="Invested Amount"
                value={formatCurrency(summary?.investedAmount)}
                tone="purple"
                subtitle="Capital deployed"
              />
              <StatCard
                title="Total Portfolio Value"
                value={formatCurrency(summary?.totalPortfolioValue)}
                tone="green"
                subtitle="Current market value"
              />
              <StatCard
                title="Total Account Value"
                value={formatCurrency(summary?.totalAccountValue)}
                tone="neutral"
                subtitle="Cash plus portfolio"
              />
            </section>

            <section className="panel">
              <div className="panel-header">
                <h2>Manage Funds</h2>
              </div>

              {actionMessage ? (
                <div className="success-message account-message">{(actionMessage)}</div>
              ) : null}
              {actionError ? (
                <div className="inline-error account-message">{(actionError)}</div>
              ) : null}

              <div className="fund-forms">
                <form className="fund-form" onSubmit={handleDeposit}>
                  <h3>Deposit Money</h3>
                  <div className="form-group">
                    <label htmlFor="deposit-amount">Amount</label>
                    <input
                      id="deposit-amount"
                      type="number"
                      min="0"
                      step="any"
                      value={depositAmount}
                      onChange={(e) => setDepositAmount(e.target.value)}
                      placeholder="0"
                    />
                  </div>
                  <button
                    type="submit"
                    className="primary-button"
                    disabled={action === 'deposit' || action === 'withdraw'}
                  >
                    {action === 'deposit' ? 'Depositing...' : 'Deposit'}
                  </button>
                </form>

                <form className="fund-form" onSubmit={handleWithdraw}>
                  <h3>Withdraw Money</h3>
                  <div className="form-group">
                    <label htmlFor="withdraw-amount">Amount</label>
                    <input
                      id="withdraw-amount"
                      type="number"
                      min="0"
                      step="any"
                      value={withdrawAmount}
                      onChange={(e) => setWithdrawAmount(e.target.value)}
                      placeholder="0"
                    />
                  </div>
                  <button
                    type="submit"
                    className="primary-button withdraw-button"
                    disabled={action === 'deposit' || action === 'withdraw'}
                  >
                    {action === 'withdraw' ? 'Withdrawing...' : 'Withdraw'}
                  </button>
                </form>
              </div>
            </section>

            <section className="panel">
              <div className="panel-header">
                <h2>Wallet History ({transactions.length})</h2>
              </div>

              {transactions.length === 0 ? (
                <div className="empty-state">
                  <p>No wallet transactions yet.</p>
                  <p>Deposit or withdraw funds to see history here.</p>
                </div>
              ) : (
                <div className="table-wrapper">
                  <table className="portfolio-table wallet-table">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Type</th>
                        <th>Amount</th>
                        <th>Balance After</th>
                        <th>Description</th>
                      </tr>
                    </thead>
                    <tbody>
                      {transactions.map((transaction) => {
                        const inflow =
                          transaction.type === 'DEPOSIT' ||
                          transaction.type === 'INITIAL_DEPOSIT';

                        return (
                          <tr key={transaction._id}>
                            <td>{formatDateTime(transaction.createdAt)}</td>
                            <td>
                              <span
                                className={`transaction-badge ${inflow ? 'buy-badge' : 'sell-badge'}`}
                              >
                                {transaction.type}
                              </span>
                            </td>
                            <td className={inflow ? 'wallet-amount inflow' : 'wallet-amount outflow'}>
                              {inflow ? '+' : '-'}
                              {formatCurrency(transaction.amount)}
                            </td>
                            <td>
                              {transaction.balanceAfter != null
                                ? formatCurrency(transaction.balanceAfter)
                                : 'N/A'}
                            </td>
                            <td>
                              {transaction.description || '—'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

          </div>
        )}
      </main>
    </div>
  );
};

export default Account;