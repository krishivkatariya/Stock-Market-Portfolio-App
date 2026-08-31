import {
  Navigate,
  Route,
  Routes
} from 'react-router-dom';

import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Portfolio from './pages/Portfolio';
import Watchlist from './pages/Watchlist';
import Transactions from './pages/Transactions';
import Account from './pages/Account';
import Orders from './pages/Orders';
import Notifications from './pages/Notifications';
import StockDetails from './pages/StockDetails';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';

import './App.css';

function App() {
  return (
    <Routes>

      <Route
        path="/"
        element={
          <Navigate
            to="/login"
            replace
          />
        }
      />

      <Route
        path="/login"
        element={<Login />}
      />

      <Route
        path="/register"
        element={<Register />}
      />

      <Route element={<ProtectedRoute />}>
        <Route element={<Layout />}>

          <Route
            path="/dashboard"
            element={<Dashboard />}
          />

          <Route
            path="/portfolio"
            element={<Portfolio />}
          />

          <Route
            path="/watchlist"
            element={<Watchlist />}
          />

          <Route
            path="/transactions"
            element={<Transactions />}
          />

          <Route
            path="/orders"
            element={<Orders />}
          />

          <Route
            path="/notifications"
            element={<Notifications />}
          />

          <Route
            path="/account"
            element={<Account />}
          />

          <Route
            path="/stock/:symbol"
            element={<StockDetails />}
          />

        </Route>
      </Route>

      <Route
        path="*"
        element={
          <Navigate
            to="/"
            replace
          />
        }
      />

    </Routes>
  );
}

export default App;
