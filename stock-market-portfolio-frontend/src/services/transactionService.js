import api from '../api/api';

// ==========================================
// Transactions API service
// Uses the existing api utility (api.js) so
// the JWT auth interceptors apply automatically.
// Backend endpoint: GET /api/transactions
// ==========================================

export const getTransactions = async () => {
  const response = await api.get('/transactions');
  return response.data;
};