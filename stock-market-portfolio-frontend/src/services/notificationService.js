import api from '../api/api';

// ==========================================
// Notifications API service
// Uses the existing api utility (api.js) so
// the JWT auth interceptors apply automatically.
// Backend endpoints (mounted at /api/notifications):
//   GET   /notifications          -> getNotifications
//   PATCH /notifications/read-all -> markNotificationsRead
// GET response: { success, count, notifications: [...] }
// ==========================================

export const getNotifications = async () => {
  const response = await api.get('/notifications');
  return response.data;
};

export const markNotificationsRead = async () => {
  const response = await api.patch('/notifications/read-all');
  return response.data;
};
