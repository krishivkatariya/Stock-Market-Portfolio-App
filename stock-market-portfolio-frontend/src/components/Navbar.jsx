import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import ThemeToggle from './ThemeToggle';
import { useAuth } from '../context/useAuth';

const MenuIcon = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M4 7h16" />
    <path d="M4 12h16" />
    <path d="M4 17h16" />
  </svg>
);

const SearchIcon = () => (
  <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="11" cy="11" r="6.5" />
    <path d="M16 16l4.5 4.5" />
  </svg>
);

const BellIcon = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M18 9a6 6 0 1 0-12 0c0 5-2 6-2 6h16s-2-1-2-6" />
    <path d="M10.3 19a2 2 0 0 0 3.4 0" />
  </svg>
);

const Navbar = ({ onMenuToggle, isSidebarOpen }) => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [query, setQuery] = useState('');

  const handleSearchSubmit = (event) => {
    event.preventDefault();

    const symbol = query.trim().toUpperCase();

    if (!symbol) {
      return;
    }

    navigate(`/stock/${encodeURIComponent(symbol)}`);
    setQuery('');
  };

  const initial = (user?.name || 'Investor').charAt(0).toUpperCase();

  return (
    <header className="app-navbar">
      <div className="navbar-left">
        <button
          type="button"
          className="nav-menu-button"
          onClick={onMenuToggle}
          aria-label="Toggle navigation menu"
          aria-expanded={isSidebarOpen}
        >
          <MenuIcon />
        </button>

        <Link to="/dashboard" className="navbar-brand">
          <span className="brand-icon">₹</span>
          <span className="navbar-brand-name">StockPilot</span>
        </Link>
      </div>

      <form
        className="nav-search"
        role="search"
        onSubmit={handleSearchSubmit}
      >
        <SearchIcon />
        <input
          type="text"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search stocks (e.g. AAPL)"
          aria-label="Search stocks by symbol"
        />
      </form>

      <div className="nav-actions">
        <Link
          to="/notifications"
          className="nav-icon-button"
          aria-label="Notifications"
          title="Notifications"
        >
          <BellIcon />
        </Link>

        <ThemeToggle />

        <Link to="/account" className="nav-account" title="Account">
          <span className="nav-avatar" aria-hidden="true">{initial}</span>
          <span className="nav-account-name">{user?.name || 'Account'}</span>
        </Link>
      </div>
    </header>
  );
};

export default Navbar;