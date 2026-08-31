import { useEffect, useState } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';

import Sidebar from './Sidebar';
import Navbar from './Navbar';
import { useAuth } from '../context/useAuth';

const Layout = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  useEffect(() => {
    if (!isSidebarOpen) {
      return undefined;
    }

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setIsSidebarOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSidebarOpen]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="app-shell">
      <Sidebar
        isOpen={isSidebarOpen}
        onNavigate={() => setIsSidebarOpen(false)}
        onLogout={handleLogout}
        user={user}
      />

      {isSidebarOpen ? (
        <div
          className="sidebar-backdrop"
          onClick={() => setIsSidebarOpen(false)}
          aria-hidden="true"
        />
      ) : null}

      <div className="app-body">
        <Navbar
          onMenuToggle={() => setIsSidebarOpen((isOpen) => !isOpen)}
          isSidebarOpen={isSidebarOpen}
        />

        <div className="app-content">
          <Outlet />
        </div>
      </div>
    </div>
  );
};

export default Layout;