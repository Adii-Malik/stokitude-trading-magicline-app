import { useState, useEffect } from 'react';
import { 
  Users, 
  UserCheck, 
  UserX, 
  ShieldCheck, 
  Trash2, 
  CheckCircle, 
  AlertCircle, 
  X,
  Search,
  Filter
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import * as adminAPI from '../../services/admin';

export default function UserManagement() {
  const { isSuperAdmin } = useAuth();
  const [users, setUsers] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [message, setMessage] = useState(null);

  useEffect(() => {
    fetchData();
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

  const handlePromoteToAdmin = async (userId, username) => {
    if (!confirm(`Promote ${username} to admin?`)) return;
    try {
      await adminAPI.promoteToAdmin(userId);
      showMessage(`${username} promoted to admin successfully`);
      fetchData();
    } catch (err) {
      showMessage(err.response?.data?.message || 'Failed to promote user', 'error');
    }
  };

  const handleDemoteFromAdmin = async (userId, username) => {
    if (!confirm(`Demote ${username} from admin?`)) return;
    try {
      await adminAPI.demoteFromAdmin(userId);
      showMessage(`${username} demoted from admin successfully`);
      fetchData();
    } catch (err) {
      showMessage(err.response?.data?.message || 'Failed to demote user', 'error');
    }
  };

  const handleDeleteUser = async (userId, username) => {
    if (!confirm(`Delete user ${username}? This action cannot be undone.`)) return;
    try {
      await adminAPI.deleteUser(userId);
      showMessage(`User ${username} deleted successfully`);
      fetchData();
    } catch (err) {
      showMessage(err.response?.data?.message || 'Failed to delete user', 'error');
    }
  };

  const getFilteredUsers = () => {
    let filtered = [...users];
    if (filter === 'active') filtered = filtered.filter(u => u.isActive);
    if (filter === 'pending') filtered = filtered.filter(u => !u.isActive);
    if (filter === 'admins') filtered = filtered.filter(u => u.role === 'admin' || u.role === 'super_admin');
    
    if (searchQuery) {
      filtered = filtered.filter(u => 
        u.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
        u.email.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    return filtered;
  };

  const filteredUsers = getFilteredUsers();

  return (
    <div>
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

      {/* Filter and Search */}
      <div className="bg-white dark:bg-gray-800/50 backdrop-blur-sm border border-gray-200 dark:border-gray-700 rounded-lg p-4 mb-6">
        <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
          {/* Filter Buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            <Filter className="w-4 h-4 text-gray-500 dark:text-gray-400" />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Filter:</span>
            {['all', 'active', 'pending', 'admins'].map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  filter === f
                    ? 'bg-cyan-600 text-white shadow-md'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="relative w-full md:w-64">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search users..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-cyan-500"
            />
          </div>
        </div>
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
            <p className="text-gray-500 dark:text-gray-400">
              {searchQuery || filter !== 'all' ? 'No users match your filters' : 'No users in the system yet'}
            </p>
          </div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-800/80">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">User</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Role</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Joined</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800/50 divide-y divide-gray-200 dark:divide-gray-700">
              {filteredUsers.map((user) => (
                <tr key={user._id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 h-10 w-10 flex items-center justify-center rounded-full bg-cyan-100 dark:bg-cyan-900/30">
                        <span className="text-cyan-600 dark:text-cyan-400 font-semibold text-lg">
                          {user.username.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900 dark:text-white">{user.username}</div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">{user.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      user.role === 'super_admin' 
                        ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
                        : user.role === 'admin'
                        ? 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-400'
                        : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                    }`}>
                      {user.role === 'super_admin' ? '👑 Super Admin' : user.role === 'admin' ? '🛡️ Admin' : '👤 User'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      user.isActive
                        ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                        : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
                    }`}>
                      {user.isActive ? '✓ Active' : '⏳ Pending'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                    {new Date(user.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex items-center justify-end gap-2">
                      {!user.isActive && (
                        <button
                          onClick={() => handleActivate(user._id, user.username)}
                          className="text-green-600 hover:text-green-900 dark:text-green-400 dark:hover:text-green-300"
                          title="Activate User"
                        >
                          <UserCheck className="w-5 h-5" />
                        </button>
                      )}
                      {user.isActive && user.role !== 'super_admin' && (
                        <button
                          onClick={() => handleDeactivate(user._id, user.username)}
                          className="text-yellow-600 hover:text-yellow-900 dark:text-yellow-400 dark:hover:text-yellow-300"
                          title="Deactivate User"
                        >
                          <UserX className="w-5 h-5" />
                        </button>
                      )}
                      {isSuperAdmin() && user.role === 'user' && (
                        <button
                          onClick={() => handlePromoteToAdmin(user._id, user.username)}
                          className="text-cyan-600 hover:text-cyan-900 dark:text-cyan-400 dark:hover:text-cyan-300"
                          title="Promote to Admin"
                        >
                          <ShieldCheck className="w-5 h-5" />
                        </button>
                      )}
                      {isSuperAdmin() && user.role === 'admin' && (
                        <button
                          onClick={() => handleDemoteFromAdmin(user._id, user.username)}
                          className="text-orange-600 hover:text-orange-900 dark:text-orange-400 dark:hover:text-orange-300"
                          title="Demote from Admin"
                        >
                          <ShieldCheck className="w-5 h-5" />
                        </button>
                      )}
                      {isSuperAdmin() && user.role !== 'super_admin' && (
                        <button
                          onClick={() => handleDeleteUser(user._id, user.username)}
                          className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
                          title="Delete User"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

