import { useCallback, useEffect, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';

import { useAuth } from '../context/useAuth';
import {
  getNotifications,
  markNotificationsRead
} from '../services/notificationService';

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
      'The notifications could not be found.';
  }

  if (error?.request) {
    return 'Unable to reach the server. Please check your connection and try again.';
  }

  return error.response?.data?.message ||
    'Something went wrong. Please try again.';
};

const typeBadgeClass = (type) => {
  const normalizedType = String(type || '').toLowerCase();

  if (normalizedType === 'order' || normalizedType === 'wallet') {
    return `notification-type-badge type-${normalizedType}`;
  }

  return 'notification-type-badge type-other';
};

const Notifications = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [markingRead, setMarkingRead] = useState(false);
  const [actionMessage, setActionMessage] = useState('');
  const [actionError, setActionError] = useState('');

  const fetchNotifications = useCallback(async () => {
    try {
      const data = await getNotifications();
      setNotifications(data?.notifications || []);
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

      await fetchNotifications();
    };

    load();

    return () => {
      active = false;
    };
  }, [fetchNotifications]);

  const handleRetry = () => {
    setLoading(true);
    setError('');
    fetchNotifications();
  };

  const handleMarkAllRead = async () => {
    setMarkingRead(true);
    setActionMessage('');
    setActionError('');

    try {
      const data = await markNotificationsRead();
      setActionMessage(data?.message || 'All notifications marked as read');
    } catch (markError) {
      if (markError?.response?.status === 401) {
        logout();
        navigate('/login');
        return;
      }

      setActionError(friendlyErrorMessage(markError));
    } finally {
      setMarkingRead(false);
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
          <p className="eyebrow">Notifications</p>
          <h1>Notifications</h1>
          <p className="subtitle">
            Recent account and trading activity in one place.
          </p>
        </section>

        {loading ? (
          <section className="panel">
            <div className="inline-loading">Loading your notifications...</div>
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
        ) : notifications.length === 0 ? (
          <section className="panel">
            <div className="empty-state">
              <p>No notifications yet.</p>
              <p>
                Orders and wallet activity will show up here as they happen.
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
            <div className="panel-header notifications-panel-header">
              <h2>Recent Activity ({notifications.length})</h2>
              <button
                type="button"
                className="text-button"
                onClick={handleMarkAllRead}
                disabled={markingRead}
              >
                {markingRead ? 'Marking...' : 'Mark all as read'}
              </button>
            </div>

            {actionMessage ? (
              <div className="success-message notifications-message">
                {actionMessage}
              </div>
            ) : null}
            {actionError ? (
              <div className="inline-error notifications-message">
                {actionError}
              </div>
            ) : null}

            <div className="notifications-list">
              {notifications.map((notification) => (
                <div
                  className="notification-item"
                  key={
                    notification.id ||
                    `${notification.type}-${notification.createdAt}`
                  }
                >
                  <span className={typeBadgeClass(notification.type)}>
                    {notification.type || 'info'}
                  </span>
                  <div className="notification-content">
                    <p className="notification-title">{notification.title}</p>
                    <p className="notification-message">
                      {notification.message}
                    </p>
                  </div>
                  <span className="notification-date">
                    {formatDateTime(notification.createdAt)}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
};

export default Notifications;
