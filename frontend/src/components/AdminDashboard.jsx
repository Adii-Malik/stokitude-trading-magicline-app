import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import * as adminAPI from '../services/admin';

const AdminDashboard = () => {
  const { user, isAdmin, isSuperAdmin } = useAuth();
  const [users, setUsers] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // all, active, pending, admins
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  useEffect(() => {
    if (isAdmin()) {
      fetchData();
    }
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const [usersResponse, statsResponse] = await Promise.all([
        adminAPI.getAllUsers(),
        adminAPI.getAdminStats()
      ]);
      
      setUsers(usersResponse.data.users);
      setStats(statsResponse.data);
    } catch (err) {
      console.error('Error fetching admin data:', err);
      setError(err.response?.data?.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleActivate = async (userId, username) => {
    if (!confirm(`Activate user: ${username}?`)) return;
    
    try {
      await adminAPI.activateUser(userId);
      setSuccessMessage(`User ${username} activated successfully`);
      fetchData();
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to activate user');
      setTimeout(() => setError(null), 3000);
    }
  };

  const handleDeactivate = async (userId, username) => {
    if (!confirm(`Deactivate user: ${username}? They will be logged out and cannot access the system.`)) return;
    
    try {
      await adminAPI.deactivateUser(userId);
      setSuccessMessage(`User ${username} deactivated successfully`);
      fetchData();
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to deactivate user');
      setTimeout(() => setError(null), 3000);
    }
  };

  const handleToggleRole = async (userId, username, currentRole) => {
    const newRole = currentRole === 'admin' ? 'user' : 'admin';
    if (!confirm(`Change ${username}'s role to ${newRole}?`)) return;
    
    try {
      await adminAPI.toggleUserRole(userId);
      setSuccessMessage(`User ${username} is now ${newRole}`);
      fetchData();
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update user role');
      setTimeout(() => setError(null), 3000);
    }
  };

  const handleDelete = async (userId, username) => {
    if (!confirm(`DELETE user: ${username}? This action cannot be undone!`)) return;
    if (!confirm(`Are you absolutely sure you want to delete ${username}?`)) return;
    
    try {
      await adminAPI.deleteUser(userId);
      setSuccessMessage(`User ${username} deleted successfully`);
      fetchData();
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete user');
      setTimeout(() => setError(null), 3000);
    }
  };

  const getFilteredUsers = () => {
    if (filter === 'all') return users;
    if (filter === 'active') return users.filter(u => u.isActive);
    if (filter === 'pending') return users.filter(u => !u.isActive);
    if (filter === 'admins') return users.filter(u => u.role === 'admin');
    return users;
  };

  if (!isAdmin()) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center p-4">
        <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-6 max-w-md">
          <h2 className="text-xl font-bold text-red-400 mb-2">Access Denied</h2>
          <p className="text-gray-300">You do not have admin privileges.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-cyan-500 mx-auto mb-4"></div>
          <p className="text-gray-400">Loading admin dashboard...</p>
        </div>
      </div>
    );
  }

  const filteredUsers = getFilteredUsers();

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">Admin Dashboard</h1>
          <p className="text-gray-400">Manage users and system settings</p>
        </div>

        {/* Success/Error Messages */}
        {successMessage && (
          <div className="mb-6 bg-green-500/10 border border-green-500/50 rounded-lg p-4">
            <p className="text-green-400 flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
              </svg>
              {successMessage}
            </p>
          </div>
        )}

        {error && (
          <div className="mb-6 bg-red-500/10 border border-red-500/50 rounded-lg p-4">
            <p className="text-red-400">{error}</p>
          </div>
        )}

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
            <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-lg p-6">
              <div className="text-gray-400 text-sm mb-1">Total Users</div>
              <div className="text-3xl font-bold text-white">{stats.totalUsers}</div>
            </div>
            <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-6">
              <div className="text-gray-400 text-sm mb-1">Active Users</div>
              <div className="text-3xl font-bold text-green-400">{stats.activeUsers}</div>
            </div>
            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-6">
              <div className="text-gray-400 text-sm mb-1">Pending Approval</div>
              <div className="text-3xl font-bold text-yellow-400">{stats.pendingUsers}</div>
            </div>
            <div className="bg-cyan-500/10 border border-cyan-500/30 rounded-lg p-6">
              <div className="text-gray-400 text-sm mb-1">Admins</div>
              <div className="text-3xl font-bold text-cyan-400">{stats.adminUsers}</div>
            </div>
          </div>
        )}

        {/* Filter Tabs */}
        <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-lg mb-6">
          <div className="flex flex-wrap gap-2 p-4">
            {['all', 'active', 'pending', 'admins'].map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  filter === f
                    ? 'bg-cyan-500 text-white'
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
                {f === 'all' && ` (${users.length})`}
                {f === 'active' && ` (${users.filter(u => u.isActive).length})`}
                {f === 'pending' && ` (${users.filter(u => !u.isActive).length})`}
                {f === 'admins' && ` (${users.filter(u => u.role === 'admin').length})`}
              </button>
            ))}
          </div>
        </div>

        {/* Users Table */}
        <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-900/50">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">User</th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Email</th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Role</th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Registered</th>
                  <th className="px-6 py-4 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="px-6 py-8 text-center text-gray-400">
                      No users found
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((u) => (
                    <tr key={u._id} className="hover:bg-gray-700/30">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-full flex items-center justify-center text-white font-bold">
                            {u.username.charAt(0).toUpperCase()}
                          </div>
                          <span className="text-white font-medium">{u.username}</span>
                          {u._id === user._id && (
                            <span className="text-xs text-cyan-400">(You)</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-gray-300">{u.email}</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          u.role === 'super_admin' ? 'bg-gradient-to-r from-yellow-500/20 to-orange-500/20 text-yellow-400 border border-yellow-500/30' :
                          u.role === 'admin' ? 'bg-purple-500/20 text-purple-400' : 'bg-gray-600/50 text-gray-300'
                        }`}>
                          {u.role === 'super_admin' ? 'Super Admin' : u.role}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          u.isActive ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'
                        }`}>
                          {u.isActive ? 'Active' : 'Pending'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-gray-300 text-sm">
                        {new Date(u.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                        {u._id !== user._id ? (
                          // Don't show any actions for super_admin if current user is not super_admin
                          u.role === 'super_admin' && !isSuperAdmin() ? (
                            <span className="text-gray-500 text-xs italic">Protected</span>
                          ) : u.role === 'admin' && !isSuperAdmin() ? (
                            // Regular admins cannot modify other admins
                            <span className="text-gray-500 text-xs italic">Admin</span>
                          ) : (
                            <div className="flex items-center justify-end gap-2">
                              {!u.isActive ? (
                                <button
                                  onClick={() => handleActivate(u._id, u.username)}
                                  className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white rounded transition-colors text-xs font-medium"
                                >
                                  Activate
                                </button>
                              ) : (
                                // Super admin cannot be deactivated
                                u.role !== 'super_admin' && (
                                  <button
                                    onClick={() => handleDeactivate(u._id, u.username)}
                                    className="px-3 py-1 bg-yellow-600 hover:bg-yellow-700 text-white rounded transition-colors text-xs font-medium"
                                  >
                                    Deactivate
                                  </button>
                                )
                              )}
                              {u.role !== 'super_admin' && isSuperAdmin() && (
                                <button
                                  onClick={() => handleToggleRole(u._id, u.username, u.role)}
                                  className="px-3 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded transition-colors text-xs font-medium"
                                >
                                  {u.role === 'admin' ? 'Make User' : 'Make Admin'}
                                </button>
                              )}
                              {/* Super admin cannot be deleted */}
                              {u.role !== 'super_admin' && (
                                <button
                                  onClick={() => handleDelete(u._id, u.username)}
                                  className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded transition-colors text-xs font-medium"
                                >
                                  Delete
                                </button>
                              )}
                            </div>
                          )
                        ) : (
                          <span className="text-gray-500 text-xs">-</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;

