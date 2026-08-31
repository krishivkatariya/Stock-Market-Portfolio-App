import { useCallback, useEffect, useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';

import { useAuth } from '../context/useAuth';
import { getOrders } from '../services/orderService';

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
      'The orders could not be found.';
  }

  if (error?.request) {
    return 'Unable to reach the server. Please check your connection and try again.';
  }

  return error.response?.data?.message ||
    'Something went wrong. Please try again.';
};

const statusBadgeClass = (status) => {
  const normalizedStatus = String(status || '').toLowerCase();

  if (['pending', 'completed', 'cancelled', 'rejected'].includes(normalizedStatus)) {
    return `order-status-badge status-${normalizedStatus}`;
  }

  return 'order-status-badge status-other';
};

const Orders = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchOrders = useCallback(async () => {
    try {
      const data = await getOrders();
      setOrders(data?.orders || []);
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

      await fetchOrders();
    };

    load();

    return () => {
      active = false;
    };
  }, [fetchOrders]);

  const handleRetry = () => {
    setLoading(true);
    setError('');
    fetchOrders();
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
          <p className="eyebrow">Orders</p>
          <h1>My Orders</h1>
          <p className="subtitle">
            Every buy and sell order placed from your account.
          </p>
        </section>

        {loading ? (
          <section className="panel">
            <div className="inline-loading">Loading your orders...</div>
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
        ) : orders.length === 0 ? (
          <section className="panel">
            <div className="empty-state">
              <p>No orders yet.</p>
              <p>
                Buying and selling stocks will create orders that show up here.
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
              <h2>Order History ({orders.length})</h2>
            </div>

            <div className="table-wrapper">
              <table className="portfolio-table transactions-table orders-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Side</th>
                    <th>Symbol</th>
                    <th>Company</th>
                    <th>Type</th>
                    <th>Quantity</th>
                    <th>Price</th>
                    <th>Total</th>
                    <th>Status</th>
                    <th>Order ID</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((order) => (
                    <tr key={order._id}>
                      <td>{formatDateTime(order.createdAt)}</td>
                      <td>
                        <span
                          className={
                            order.side === 'BUY'
                              ? 'transaction-badge buy-badge'
                              : 'transaction-badge sell-badge'
                          }
                        >
                          {order.side}
                        </span>
                      </td>
                      <td className="transaction-symbol">
                        <Link to={`/stock/${order.symbol}`} className="stock-symbol-link">
                          {order.symbol}
                        </Link>
                      </td>
                      <td>{order.companyName || 'Unknown company'}</td>
                      <td>{order.orderType || 'N/A'}</td>
                      <td>{order.quantity}</td>
                      <td>{formatCurrency(order.price)}</td>
                      <td className="transaction-total">
                        {formatCurrency(order.totalAmount)}
                      </td>
                      <td>
                        <span className={statusBadgeClass(order.status)}>
                          {order.status || 'N/A'}
                        </span>
                      </td>
                      <td className="order-id-cell" title={order._id}>
                        {order._id}
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

export default Orders;
