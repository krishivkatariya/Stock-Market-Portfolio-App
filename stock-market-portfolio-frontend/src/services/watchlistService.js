import api from '../api/api';

// ==========================================
// Watchlist API service
// Uses the existing api utility (api.js) so
// the JWT auth interceptors apply automatically.
// Backend endpoints: GET /api/watchlist,
// POST /api/watchlist, DELETE /api/watchlist/:symbol
// ==========================================

export const getWatchlist = async () => {
  const response = await api.get('/watchlist');
  return response.data;
};

export const addToWatchlist = async (symbol) => {
  const response = await api.post('/watchlist', {
    symbol
  });
  return response.data;
};

export const removeFromWatchlist = async (symbol) => {
  const response = await api.delete(
    `/watchlist/${encodeURIComponent(symbol)}`
  );
  return response.data;
};