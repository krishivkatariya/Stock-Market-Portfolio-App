import { NavLink } from 'react-router-dom';

const DashboardIcon = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="3" y="3" width="7" height="7" rx="1.5" />
    <rect x="14" y="3" width="7" height="7" rx="1.5" />
    <rect x="3" y="14" width="7" height="7" rx="1.5" />
    <rect x="14" y="14" width="7" height="7" rx="1.5" />
  </svg>
);

const PortfolioIcon = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="3" y="7" width="18" height="13" rx="2" />
    <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    <path d="M3 12.5h18" />
  </svg>
);

const WatchlistIcon = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 3.5l2.6 5.3 5.9.9-4.2 4.1 1 5.8L12 16.9l-5.3 2.7 1-5.8-4.2-4.1 5.9-.9z" />
  </svg>
);

const OrdersIcon = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="5" y="4" width="14" height="17" rx="2" />
    <path d="M9 2.5h6V7H9z" />
    <path d="M9 11.5h6" />
    <path d="M9 15.5h4" />
  </svg>
);

const TransactionsIcon = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M4 7h13" />
    <path d="M14 3.5L17.5 7 14 10.5" />
    <path d="M20 17H7" />
    <path d="M10 13.5L6.5 17l3.5 3.5" />
  </svg>
);

const AccountIcon = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M4 7a2 2 0 0 1 2-2h11" />
    <rect x="3" y="7" width="18" height="12" rx="2" />
    <circle cx="16.5" cy="13" r="1.2" />
  </svg>
);

const NotificationsIcon = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M18 9a6 6 0 1 0-12 0c0 5-2 6-2 6h16s-2-1-2-6" />
    <path d="M10.3 19a2 2 0 0 0 3.4 0" />
  </svg>
);

const IPOIcon = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M4 19.5h16" />
    <path d="M6 17V8l6-3 6 3v9" />
    <path d="M9 17v-4h6v4" />
    <path d="M8 9h8" />
  </svg>
);

const LogoutIcon = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M9 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h3" />
    <path d="M15 8l4 4-4 4" />
    <path d="M19 12H9" />
  </svg>
);

const CloseIcon = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M6 6l12 12" />
    <path d="M18 6L6 18" />
  </svg>
);

const NAV_ITEMS = [
  { label: 'Dashboard', to: '/dashboard', Icon: DashboardIcon },
  { label: 'Portfolio', to: '/portfolio', Icon: PortfolioIcon },
  { label: 'Watchlist', to: '/watchlist', Icon: WatchlistIcon },
  { label: 'Orders', to: '/orders', Icon: OrdersIcon },
  { label: 'Transactions', to: '/transactions', Icon: TransactionsIcon },
  { label: 'Account', to: '/account', Icon: AccountIcon },
  { label: 'Notifications', to: '/notifications', Icon: NotificationsIcon }
  ,{ label: 'IPO centre', to: '/ipo', Icon: IPOIcon }
];

const Sidebar = ({ isOpen, onNavigate, onLogout, user }) => {
  const initial = (user?.name || 'Investor').charAt(0).toUpperCase();

  return (
    <aside
      className={`app-sidebar${isOpen ? ' open' : ''}`}
      aria-label="Primary navigation"
    >
      <div className="sidebar-header">
        <div className="brand-icon">₹</div>
        <div className="sidebar-brand-text">
          <span className="sidebar-brand-name">StockPilot</span>
          <span className="sidebar-brand-tag">Stock Market Portfolio</span>
        </div>
        <button
          type="button"
          className="sidebar-close"
          onClick={onNavigate}
          aria-label="Close navigation menu"
        >
          <CloseIcon />
        </button>
      </div>

      <nav className="sidebar-nav">
        {NAV_ITEMS.map(({ label, to, Icon }) => (
          <NavLink
            key={to}
            to={to}
            onClick={onNavigate}
            className={({ isActive }) =>
              `sidebar-link${isActive ? ' active' : ''}`
            }
          >
            <Icon />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-footer">
        <div className="sidebar-user">
          <span className="sidebar-avatar" aria-hidden="true">{initial}</span>
          <div className="sidebar-user-meta">
            <span className="sidebar-user-name">{user?.name || 'Investor'}</span>
            {user?.email ? (
              <span className="sidebar-user-email">{user.email}</span>
            ) : null}
          </div>
        </div>

        <button type="button" className="sidebar-logout" onClick={onLogout}>
          <LogoutIcon />
          <span>Logout</span>
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;