import api from '../api/api';

// ==========================================
// Stock API service
// Uses the existing api utility (api.js) so
// the JWT auth interceptors apply automatically.
// Backend endpoints (mounted at /api/stocks):
//   GET /stocks/:symbol                 -> quote
//   GET /stocks/:symbol/history?outputsize=N -> historical OHLCV
// Allowed outputsize values: 7, 30, 90, 180, 365
// ==========================================

export const getStockQuote = async (symbol) => {
  const response = await api.get(
    `/stocks/${encodeURIComponent(symbol)}`
  );
  return response.data;
};

export const getStockHistory = async (symbol, outputsize) => {
  const response = await api.get(
    `/stocks/${encodeURIComponent(symbol)}/history`,
    {
      params: {
        outputsize
      }
    }
  );
  return response.data;
};