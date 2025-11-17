import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import AdminHeader from './AdminHeader';
import UserManagement from './UserManagement';
import JobsDashboard from './Jobs/JobsDashboard';
import SettingsComponent from './Settings';
import TradingBot from './TradingBot/TradingBot';
import StockManagement from './StockManagement';
import HistoricalDataViewer from './HistoricalDataViewer';

export default function AdminDashboard({ onBackToMain = () => {} }) {
  const { isAdmin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const getActiveTab = () => {
    const path = location.pathname;
    if (path.includes('/stocks') || path.includes('/historical')) return 'stocks';
    if (path.includes('/jobs')) return 'jobs';
    if (path.includes('/bot')) return 'bot';
    if (path.includes('/settings')) return 'settings';
    return 'users';
  };

  const handleTabChange = (tab) => {
    const routes = {
      users: '/admin',
      stocks: '/admin/stocks',
      jobs: '/admin/jobs',
      bot: '/admin/bot',
      settings: '/admin/settings'
    };
    navigate(routes[tab]);
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

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-950">
      <AdminHeader
        activeTab={getActiveTab()}
        onTabChange={handleTabChange}
        onBackToMain={onBackToMain}
      />

      <div className="container mx-auto px-4 py-8">
        <Routes>
          <Route index element={<UserManagement />} />
          <Route path="stocks" element={<StockManagement />} />
          <Route path="historical/:symbol" element={<HistoricalDataViewer />} />
          <Route path="jobs" element={<JobsDashboard />} />
          <Route path="bot" element={<TradingBot />} />
          <Route path="settings" element={<SettingsComponent />} />
        </Routes>
      </div>
    </div>
  );
}
