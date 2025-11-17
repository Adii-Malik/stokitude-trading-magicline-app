import api from './api';

// Get all users
export const getAllUsers = async () => {
  const response = await api.get('/admin/users');
  return response.data;
};

// Get pending users
export const getPendingUsers = async () => {
  const response = await api.get('/admin/users/pending');
  return response.data;
};

// Activate user
export const activateUser = async (userId) => {
  const response = await api.put(`/admin/users/${userId}/activate`);
  return response.data;
};

// Deactivate user
export const deactivateUser = async (userId) => {
  const response = await api.put(`/admin/users/${userId}/deactivate`);
  return response.data;
};

// Promote user to admin
export const promoteToAdmin = async (userId) => {
  const response = await api.put(`/admin/users/${userId}/promote`);
  return response.data;
};

// Demote user from admin
export const demoteFromAdmin = async (userId) => {
  const response = await api.put(`/admin/users/${userId}/demote`);
  return response.data;
};

// Delete user
export const deleteUser = async (userId) => {
  const response = await api.delete(`/admin/users/${userId}`);
  return response.data;
};

// Get admin stats
export const getAdminStats = async () => {
  const response = await api.get('/admin/stats');
  return response.data;
};

