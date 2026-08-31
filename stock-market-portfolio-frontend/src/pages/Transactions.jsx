import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { useAuth } from '../context/useAuth';
import { getTransactions } from '../services/transactionService';

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
      'The transactions could not be found.';
  }

  if (error?.request) {
    return 'Unable to reach the server. Please check your connection and try again.';
  }

  return error.response?.data?.message ||
    'Something went wrong. Please try again.';
};

const Transactions = () => {
  const navigate = useNavigate();
  const { logout } = useAuth();

  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchTransactions = useCallback(async () => {
    try {
      const data = await getTransactions();
      setTransactions(data?.transactions || []);
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
  }, [logout, navigate]);

  useEffect(() => {
    let active = true;

    const load = async () => {
      if (!active) {
        return;
      }

      await fetchTransactions();
    };

    load();

    return () => {
      active = false;
    };
  }, [fetchTransactions]);

  const handleRetry = () => {
    setLoading(true);
    setError('');
    fetchTransactions();
  };

  return (
<div className="dashboard-app">
      <main className="dashboard-main">
        <section className="page-header">
          <p className="eyebrow">Account</p>
          <h1>Transactions</h1>
          <p className="subtitle">
            Your complete buy and sell history.
          </p>
        </section>

        {loading ? (
          <section className="panel">
            <div className="inline-loading">Loading your transactions...</div>
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
        ) : transactions.length === 0 ? (
          <section className="panel">
            <div className="empty-state">
              <p>No transactions yet.</p>
              <p>
                Buying and selling stocks will show up here as your history.
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
              <h2>Transaction History ({transactions.length})</h2>
            </div>

            <div className="table-wrapper">
              <table className="portfolio-table transactions-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Type</th>
                    <th>Symbol</th>
                    <th>Company</th>
                    <th>Quantity</th>
                    <th>Price</th>
                    <th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((transaction) => (
                    <tr key={transaction._id}>
                      <td>{formatDateTime(transaction.createdAt)}</td>
                      <td>
                        <span
                          className={
                            transaction.type === 'BUY'
                              ? 'transaction-badge buy-badge'
                              : 'transaction-badge sell-badge'
                          }
                        >
                          {transaction.type}
                        </span>
                      </td>
                      <td className="transaction-symbol">
                        <Link to={`/stock/${transaction.symbol}`} className="stock-symbol-link">
                          {transaction.symbol}
                        </Link>
                      </td>
                      <td>{transaction.companyName || 'Unknown company'}</td>
                      <td>{transaction.quantity}</td>
                      <td>{formatCurrency(transaction.price)}</td>
                      <td className="transaction-total">
                        {formatCurrency(transaction.totalAmount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </main>
    </div>
  );
};

export default Transactions;