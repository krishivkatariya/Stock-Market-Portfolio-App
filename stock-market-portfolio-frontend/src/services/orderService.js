import api from '../api/api';

// ==========================================
// Orders API service
// Uses the existing api utility (api.js) so
// the JWT auth interceptors apply automatically.
// Backend endpoint (mounted at /api/orders):
//   GET /orders -> logged-in user's orders
// Response: { success, count, orders: [...] }
// ==========================================

export const getOrders = async () => {
  const response = await api.get('/orders');
  return response.data;
};
