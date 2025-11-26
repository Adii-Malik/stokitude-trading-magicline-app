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

// Get available notification features
export const getNotificationFeatures = async () => {
  const response = await api.get('/notifications/features');
  return response.data;
};

// Send test notification (basic)
export const sendTestNotification = async () => {
  const response = await api.post('/notifications/test');
  return response.data;
};

// Test magic line notification
export const testMagicLineNotification = async () => {
  const response = await api.post('/notifications/test-magic-line');
  return response.data;
};

// Test trade plan notification
export const testTradePlanNotification = async (type = 'buy') => {
  const response = await api.post('/notifications/test-trade-plan', { type });
  return response.data;
};

// Test admin notification
export const testAdminNotification = async () => {
  const response = await api.post('/notifications/test-admin');
  return response.data;
};

// Get email debug info
export const getEmailDebugInfo = async () => {
  const response = await api.get('/notifications/email-debug');
  return response.data;
};

// Send direct test email
export const sendTestEmail = async () => {
  const response = await api.post('/notifications/test-email');
  return response.data;
};

// Trigger manual magic line check
export const triggerMagicLineCheck = async () => {
  const response = await api.post('/notifications/test-magic-line-trigger');
  return response.data;
};

// Mock magic line met for a symbol
export const mockMagicLineMet = async (symbol) => {
  const response = await api.post('/notifications/test-magic-line-mock', { symbol });
  return response.data;
};

// Trigger manual trade plan check
export const triggerTradePlanCheck = async () => {
  const response = await api.post('/notifications/test-trade-plan-trigger');
  return response.data;
};

// Mock trade plan scenario
export const mockTradePlanScenario = async (planId, scenario) => {
  const response = await api.post('/notifications/test-trade-plan-mock', { planId, scenario });
  return response.data;
};

// Reset trade plan state
export const resetTradePlan = async (planId) => {
  const response = await api.post('/notifications/test-trade-plan-reset', { planId });
  return response.data;
};

export default {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  clearReadNotifications,
  getNotificationFeatures,
  getPreferences,
  updatePreferences,
  sendTestNotification
};

