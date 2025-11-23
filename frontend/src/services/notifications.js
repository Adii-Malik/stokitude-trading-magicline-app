import api from './api';

// Get user's notifications
export const getNotifications = async (params = {}) => {
  const response = await api.get('/notifications', { params });
  return response.data;
};

// Get unread count
export const getUnreadCount = async () => {
  const response = await api.get('/notifications/unread-count');
  return response.data;
};

// Mark notification as read
export const markAsRead = async (notificationId) => {
  const response = await api.put(`/notifications/${notificationId}/read`);
  return response.data;
};

// Mark all as read
export const markAllAsRead = async () => {
  const response = await api.put('/notifications/mark-all-read');
  return response.data;
};

// Delete notification
export const deleteNotification = async (notificationId) => {
  const response = await api.delete(`/notifications/${notificationId}`);
  return response.data;
};

// Clear all read notifications
export const clearReadNotifications = async () => {
  const response = await api.delete('/notifications/clear-read');
  return response.data;
};

// Get notification preferences
export const getPreferences = async () => {
  const response = await api.get('/notifications/preferences');
  return response.data;
};

// Update notification preferences
export const updatePreferences = async (preferences) => {
  const response = await api.put('/notifications/preferences', preferences);
  return response.data;
};

// Send test notification
export const sendTestNotification = async () => {
  const response = await api.post('/notifications/test');
  return response.data;
};

export default {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  clearReadNotifications,
  getPreferences,
  updatePreferences,
  sendTestNotification
};

