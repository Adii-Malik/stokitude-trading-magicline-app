import { useState, useEffect } from 'react';
import { 
  Shield, 
  Users, 
  UserCheck, 
  UserX, 
  ShieldCheck, 
  Trash2, 
  CheckCircle, 
  AlertCircle, 
  X,
  Search,
  Filter,
  Settings
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import * as adminAPI from '../services/admin';
import JobsDashboard from './Jobs/JobsDashboard';

export default function AdminDashboard() {
  const { user, isAdmin, isSuperAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState('users'); // 'users' | 'jobs'
  const [users, setUsers] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // all, active, pending, admins
  const [searchQuery, setSearchQuery] = useState('');
  const [message, setMessage] = useState(null);

  useEffect(() => {
    if (isAdmin()) {
      fetchData();
    }
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      const [usersResponse, statsResponse] = await Promise.all([
        adminAPI.getAllUsers(),
        adminAPI.getAdminStats()
      ]);
      
      setUsers(usersResponse.data.users);
      setStats(statsResponse.data);
    } catch (err) {
      console.error('Error fetching admin data:', err);
      showMessage(err.response?.data?.message || 'Failed to load data', 'error');
    } finally {
      setLoading(false);
    }
  };

  const showMessage = (text, type = 'success') => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 5000);
  };

  const handleActivate = async (userId, username) => {
    if (!confirm(`Activate user: ${username}?`)) return;
    
    try {
      await adminAPI.activateUser(userId);
      showMessage(`User ${username} activated successfully`);
      fetchData();
    } catch (err) {
      showMessage(err.response?.data?.message || 'Failed to activate user', 'error');
    }
  };

  const handleDeactivate = async (userId, username) => {
    if (!confirm(`Deactivate user: ${username}? They will be logged out and cannot access the system.`)) return;
    
    try {
      await adminAPI.deactivateUser(userId);
      showMessage(`User ${username} deactivated successfully`);
      fetchData();
    } catch (err) {
      showMessage(err.response?.data?.message || 'Failed to deactivate user', 'error');
    }
  };

  const handleToggleRole = async (userId, username, currentRole) => {
    const newRole = currentRole === 'admin' ? 'user' : 'admin';
    if (!confirm(`Change ${username}'s role to ${newRole}?`)) return;
    
    try {
      await adminAPI.toggleUserRole(userId);
      showMessage(`User ${username} is now ${newRole}`);
      fetchData();
    } catch (err) {
      showMessage(err.response?.data?.message || 'Failed to update user role', 'error');
    }
  };

  const handleDelete = async (userId, username) => {
    if (!confirm(`DELETE user: ${username}? This action cannot be undone!`)) return;
    if (!confirm(`Are you absolutely sure you want to delete ${username}?`)) return;
    
    try {
      await adminAPI.deleteUser(userId);
      showMessage(`User ${username} deleted successfully`);
      fetchData();
    } catch (err) {
      showMessage(err.response?.data?.message || 'Failed to delete user', 'error');
    }
  };

  const getFilteredUsers = () => {
    let filtered = users;
    
    // Apply role/status filter
    if (filter === 'active') filtered = filtered.filter(u => u.isActive);
    if (filter === 'pending') filtered = filtered.filter(u => !u.isActive);
    if (filter === 'admins') filtered = filtered.filter(u => u.role === 'admin' || u.role === 'super_admin');
    
    // Apply search filter
    if (searchQuery) {
      filtered = filtered.filter(u => 
        u.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
        u.email.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    
    return filtered;
  };

  if (!isAdmin()) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex items-center justify-center p-4">
        <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/50 rounded-lg p-6 max-w-md">
          <h2 className="text-xl font-bold text-red-700 dark:text-red-400 mb-2">Access Denied</h2>
          <p className="text-red-600 dark:text-red-300">You do not have admin privileges.</p>
        </div>
      </div>
    );
  }

  const filteredUsers = getFilteredUsers();

  return (
    <div>
      <div className="container mx-auto px-4 py-8">
        {/* Tabs */}
        <div className="border-b border-gray-200 dark:border-gray-700 mb-6">
          <div className="flex gap-4">
            <button
              onClick={() => setActiveTab('users')}
              className={`px-4 py-3 font-medium transition-all flex items-center gap-2 ${
                activeTab === 'users'
                  ? 'border-b-2 border-cyan-600 text-cyan-600 dark:text-cyan-400'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-300'
              }`}
            >
              <Users className="w-5 h-5" />
              Users
            </button>
            <button
              onClick={() => setActiveTab('jobs')}
              className={`px-4 py-3 font-medium transition-all flex items-center gap-2 ${
                activeTab === 'jobs'
                  ? 'border-b-2 border-cyan-600 text-cyan-600 dark:text-cyan-400'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-300'
              }`}
            >
              <Settings className="w-5 h-5" />
              Jobs
            </button>
          </div>
        </div>

        {/* Content */}
        {activeTab === 'users' ? (
          <div>
            {/* Header */}
            <div className="mb-8">
              <div className="flex items-center gap-3 mb-4">
                <Shield className="w-8 h-8 text-cyan-500 dark:text-cyan-400" />
                <div>
                  <h1 className="text-3xl font-bold text-gray-900 dark:text-white">User Management</h1>
                  <p className="text-gray-600 dark:text-gray-400">Manage users, roles, and permissions</p>
                </div>
              </div>

          {/* Message Banner */}
          {message && (
            <div className={`p-4 rounded-lg mb-4 flex items-start gap-3 ${
              message.type === 'success'
                ? 'bg-green-50 dark:bg-green-500/10 border border-green-200 dark:border-green-500/50 text-green-700 dark:text-green-400'
                : 'bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/50 text-red-700 dark:text-red-400'
            }`}>
              {message.type === 'success' ? (
                <CheckCircle className="w-5 h-5 flex-shrink-0" />
              ) : (
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
              )}
              <span className="flex-1">{message.text}</span>
              <button onClick={() => setMessage(null)} className="text-current hover:opacity-70">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Stats Cards */}
          {stats && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-white dark:bg-gray-800/50 backdrop-blur-sm border border-gray-200 dark:border-gray-700 rounded-lg p-6">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-gray-600 dark:text-gray-400 text-sm">Total Users</div>
                  <Users className="w-5 h-5 text-gray-400 dark:text-gray-500" />
                </div>
                <div className="text-3xl font-bold text-gray-900 dark:text-white">{stats.totalUsers}</div>
              </div>
              <div className="bg-white dark:bg-gray-800/50 backdrop-blur-sm border border-green-200 dark:border-green-500/30 rounded-lg p-6">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-gray-600 dark:text-gray-400 text-sm">Active Users</div>
                  <UserCheck className="w-5 h-5 text-green-500 dark:text-green-400" />
                </div>
                <div className="text-3xl font-bold text-green-600 dark:text-green-400">{stats.activeUsers}</div>
              </div>
              <div className="bg-white dark:bg-gray-800/50 backdrop-blur-sm border border-yellow-200 dark:border-yellow-500/30 rounded-lg p-6">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-gray-600 dark:text-gray-400 text-sm">Pending Approval</div>
                  <UserX className="w-5 h-5 text-yellow-500 dark:text-yellow-400" />
                </div>
                <div className="text-3xl font-bold text-yellow-600 dark:text-yellow-400">{stats.pendingUsers}</div>
              </div>
              <div className="bg-white dark:bg-gray-800/50 backdrop-blur-sm border border-cyan-200 dark:border-cyan-500/30 rounded-lg p-6">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-gray-600 dark:text-gray-400 text-sm">Admins</div>
                  <ShieldCheck className="w-5 h-5 text-cyan-500 dark:text-cyan-400" />
                </div>
                <div className="text-3xl font-bold text-cyan-600 dark:text-cyan-400">{stats.adminUsers}</div>
              </div>
            </div>
          )}

          {/* Filter and Search Section */}
          <div className="bg-white dark:bg-gray-800/50 backdrop-blur-sm border border-gray-200 dark:border-gray-700 rounded-lg p-4">
            <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
              {/* Filter Buttons */}
              <div className="flex items-center gap-2 flex-wrap">
                <Filter className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Filter:</span>
                <button
                  onClick={() => setFilter('all')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                    filter === 'all'
                      ? 'bg-cyan-600 text-white shadow-md'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                >
                  All ({users.length})
                </button>
                <button
                  onClick={() => setFilter('active')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 flex items-center gap-1 ${
                    filter === 'active'
                      ? 'bg-green-600 text-white shadow-md'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                >
                  <UserCheck className="w-4 h-4" />
                  Active ({users.filter(u => u.isActive).length})
                </button>
                <button
                  onClick={() => setFilter('pending')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 flex items-center gap-1 ${
                    filter === 'pending'
                      ? 'bg-yellow-600 text-white shadow-md'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                >
                  <UserX className="w-4 h-4" />
                  Pending ({users.filter(u => !u.isActive).length})
                </button>
                <button
                  onClick={() => setFilter('admins')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 flex items-center gap-1 ${
                    filter === 'admins'
                      ? 'bg-cyan-600 text-white shadow-md'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                >
                  <Shield className="w-4 h-4" />
                  Admins ({users.filter(u => u.role === 'admin' || u.role === 'super_admin').length})
                </button>
              </div>

              {/* Search Input */}
              <div className="relative w-full md:w-64">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search users..."
                  className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-white"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Results Info */}
          {(searchQuery || filter !== 'all') && (
            <div className="mt-4 bg-cyan-50 dark:bg-cyan-500/10 border border-cyan-200 dark:border-cyan-500/50 rounded-lg p-3 flex items-center gap-2">
              <Filter className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
              <span className="text-sm text-cyan-800 dark:text-cyan-300">
                Showing <span className="font-bold">{filteredUsers.length}</span> of {users.length} users
                {searchQuery && <span> matching "<span className="font-semibold">{searchQuery}</span>"</span>}
              </span>
              {(searchQuery || filter !== 'all') && (
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setFilter('all');
                  }}
                  className="ml-auto text-sm text-cyan-600 dark:text-cyan-400 hover:text-cyan-800 dark:hover:text-cyan-300 font-medium hover:underline"
                >
                  Clear filters
                </button>
              )}
            </div>
          )}
        </div>

        {/* Users Table */}
        <div className="bg-white dark:bg-gray-800/50 backdrop-blur-sm border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden shadow-md">
          {loading ? (
            <div className="p-12 text-center">
              <div className="animate-spin w-8 h-8 border-4 border-cyan-500 border-t-transparent rounded-full mx-auto"></div>
              <p className="mt-4 text-gray-600 dark:text-gray-400">Loading users...</p>
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="p-12 text-center">
              <Users className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-700 dark:text-gray-300 mb-2">No Users Found</h3>
              <p className="text-gray-500 dark:text-gray-400 mb-4">
                {searchQuery || filter !== 'all'
                  ? 'No users match your filters'
                  : 'No users in the system yet'
                }
              </p>
              {(searchQuery || filter !== 'all') && (
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setFilter('all');
                  }}
                  className="px-4 py-2 bg-cyan-500 hover:bg-cyan-600 text-white rounded-lg transition-colors flex items-center gap-2"
                >
                  <X className="w-4 h-4" />
                  <span className="hidden sm:inline">Clear Filters</span>
                  <span className="sm:hidden">Clear</span>
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-900/50">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wider">User</th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wider">Email</th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wider">Role</th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wider">Registered</th>
                    <th className="px-6 py-4 text-right text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {filteredUsers.map((u) => (
                    <tr key={u._id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <div className="w-10 h-10 bg-gradient-to-br from-cyan-500 to-cyan-600 rounded-full flex items-center justify-center text-white font-bold">
                            {u.username.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-gray-900 dark:text-white font-medium">{u.username}</span>
                              {u._id === user._id && (
                                <span className="text-xs text-cyan-600 dark:text-cyan-400 bg-cyan-100 dark:bg-cyan-500/20 px-2 py-0.5 rounded">(You)</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-gray-700 dark:text-gray-300">{u.email}</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          u.role === 'super_admin' 
                            ? 'bg-gradient-to-r from-yellow-100 to-orange-100 dark:from-yellow-500/20 dark:to-orange-500/20 text-yellow-700 dark:text-yellow-400 border border-yellow-300 dark:border-yellow-500/30' 
                            : u.role === 'admin' 
                            ? 'bg-cyan-100 dark:bg-cyan-500/20 text-cyan-700 dark:text-cyan-400 border border-cyan-200 dark:border-cyan-500/30' 
                            : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                        }`}>
                          {u.role === 'super_admin' ? 'Super Admin' : u.role}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          u.isActive 
                            ? 'bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-500/30' 
                            : 'bg-yellow-100 dark:bg-yellow-500/20 text-yellow-700 dark:text-yellow-400 border border-yellow-200 dark:border-yellow-500/30'
                        }`}>
                          {u.isActive ? 'Active' : 'Pending'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-gray-700 dark:text-gray-300 text-sm">
                        {new Date(u.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        {u._id !== user._id ? (
                          u.role === 'super_admin' && !isSuperAdmin() ? (
                            <span className="text-gray-500 dark:text-gray-400 text-xs italic">Protected</span>
                          ) : u.role === 'admin' && !isSuperAdmin() ? (
                            <span className="text-gray-500 dark:text-gray-400 text-xs italic">Admin</span>
                          ) : (
                            <div className="flex items-center justify-end gap-2">
                              {!u.isActive ? (
                                <button
                                  onClick={() => handleActivate(u._id, u.username)}
                                  className="p-2 text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-500/20 rounded-lg transition"
                                  title="Activate"
                                >
                                  <UserCheck className="w-4 h-4" />
                                </button>
                              ) : (
                                u.role !== 'super_admin' && (
                                  <button
                                    onClick={() => handleDeactivate(u._id, u.username)}
                                    className="p-2 text-yellow-600 dark:text-yellow-400 hover:bg-yellow-50 dark:hover:bg-yellow-500/20 rounded-lg transition"
                                    title="Deactivate"
                                  >
                                    <UserX className="w-4 h-4" />
                                  </button>
                                )
                              )}
                              {u.role !== 'super_admin' && isSuperAdmin() && (
                                <button
                                  onClick={() => handleToggleRole(u._id, u.username, u.role)}
                                  className="p-2 text-cyan-600 dark:text-cyan-400 hover:bg-cyan-50 dark:hover:bg-cyan-500/20 rounded-lg transition"
                                  title={u.role === 'admin' ? 'Make User' : 'Make Admin'}
                                >
                                  <ShieldCheck className="w-4 h-4" />
                                </button>
                              )}
                              {u.role !== 'super_admin' && (
                                <button
                                  onClick={() => handleDelete(u._id, u.username)}
                                  className="p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/20 rounded-lg transition"
                                  title="Delete"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          )
                        ) : (
                          <span className="text-gray-400 dark:text-gray-500 text-xs">-</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
          </div>
        ) : (
          <JobsDashboard />
        )}
      </div>
    </div>
  );
}
