import { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { initNative } from './services/native';
import { lazy, Suspense } from 'react';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { LayoutProvider } from './components/Layout';
import { FullPageLoader } from './components/common';
import Dashboard from './components/Dashboard';
import AdminDashboard from './components/Admin/AdminDashboard';
import Notifications from './components/Notifications';
import Login from './components/Login';
import Signup from './components/Signup';
import Landing from './components/Landing';
import Profile from './components/Profile';
import ForgotPassword from './components/ForgotPassword';
import ResetPassword from './components/ResetPassword';
import PortfolioList from './components/Portfolio/PortfolioList';
import PortfolioDetail from './components/Portfolio/PortfolioDetail';
import SymbolDetail from './components/Portfolio/SymbolDetail';
import JournalPage from './components/Journal/JournalPage';
import featureFlags from './config/featureFlags';

// Conditionally import dev tools only in development
const DevToolsPanel = import.meta.env.MODE === 'development'
  ? lazy(() => import('./test/components/DevToolsPanel'))
  : null;

const TestingPage = import.meta.env.MODE === 'development'
  ? lazy(() => import('./test/pages/TestingPage'))
  : null;

// Protected Route Component
function ProtectedRoute({ children, adminOnly = false }) {
  const { user, loading, isAdmin } = useAuth();

  if (loading) {
    return <FullPageLoader />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (adminOnly && !isAdmin()) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}

function AppContent() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  // No-op in a browser; wires the status bar and Android back button in the app.
  useEffect(() => { initNative(navigate); }, [navigate]);

  // Loading state
  if (loading) {
    return <FullPageLoader />;
  }

  return (
    <Routes>
      {/* Public Routes */}
      <Route path="/" element={
        user ? <Navigate to="/dashboard" replace /> : <Landing
          onSwitchToLogin={() => navigate('/login')}
          onSwitchToSignup={() => navigate('/signup')}
        />
      } />

      <Route path="/login" element={
        user ? <Navigate to="/dashboard" replace /> : <Login
          onSwitchToSignup={() => navigate('/signup')}
          onSwitchToForgotPassword={() => navigate('/forgot-password')}
          onBackToDashboard={() => navigate('/')}
        />
      } />

      <Route path="/signup" element={
        user ? <Navigate to="/dashboard" replace /> : <Signup
          onSwitchToLogin={() => navigate('/login')}
          onBackToDashboard={() => navigate('/')}
        />
      } />

      <Route path="/forgot-password" element={
        user ? <Navigate to="/dashboard" replace /> : <ForgotPassword
          onBackToLogin={() => navigate('/login')}
        />
      } />

      <Route path="/reset-password" element={
        user ? <Navigate to="/dashboard" replace /> : <ResetPassword
          onBackToLogin={() => navigate('/login')}
        />
      } />

      {/* Protected Routes */}
      <Route path="/dashboard" element={
        <ProtectedRoute>
          <LayoutProvider currentPage="dashboard">
            <Dashboard />
          </LayoutProvider>
        </ProtectedRoute>
      } />

      {/* Portfolios */}
      <Route path="/portfolios" element={
        <ProtectedRoute>
          <LayoutProvider currentPage="portfolios">
            <PortfolioList />
          </LayoutProvider>
        </ProtectedRoute>
      } />

      <Route path="/portfolios/:id" element={
        <ProtectedRoute>
          <LayoutProvider currentPage="portfolios">
            <PortfolioDetail />
          </LayoutProvider>
        </ProtectedRoute>
      } />

      <Route path="/portfolios/:id/:symbol" element={
        <ProtectedRoute>
          <LayoutProvider currentPage="portfolios">
            <SymbolDetail />
          </LayoutProvider>
        </ProtectedRoute>
      } />

      <Route path="/journal" element={
        <ProtectedRoute>
          <LayoutProvider currentPage="journal">
            <JournalPage />
          </LayoutProvider>
        </ProtectedRoute>
      } />

      {/* Profile */}
      <Route path="/profile" element={
        <ProtectedRoute>
          <LayoutProvider currentPage="profile">
            <Profile />
          </LayoutProvider>
        </ProtectedRoute>
      } />

      {/* Notifications */}
      <Route path="/notifications" element={
        <ProtectedRoute>
          <LayoutProvider currentPage="notifications">
            <Notifications />
          </LayoutProvider>
        </ProtectedRoute>
      } />

      {/* Admin Dashboard - All admin routes handled internally */}
      <Route path="/admin/*" element={
        <ProtectedRoute adminOnly>
          <AdminDashboard onBackToMain={() => navigate('/dashboard')} />
        </ProtectedRoute>
      } />

      {/* Development Testing Page - Only in dev mode */}
      {TestingPage && (
        <Route path="/testing" element={
          <ProtectedRoute>
            <Suspense fallback={<FullPageLoader />}>
              <TestingPage />
            </Suspense>
          </ProtectedRoute>
        } />
      )}

      {/* Catch all - redirect to home */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <Router>
      <AuthProvider>
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 3000,
            style: {
              background: '#363636',
              color: '#fff',
            },
            success: {
              duration: 3000,
              iconTheme: {
                primary: '#10b981',
                secondary: '#fff',
              },
            },
            error: {
              duration: 4000,
              iconTheme: {
                primary: '#ef4444',
                secondary: '#fff',
              },
            },
          }}
        />
        <AppContent />
        {featureFlags.devMode && DevToolsPanel && (
          <Suspense fallback={null}>
            <DevToolsPanel />
          </Suspense>
        )}
      </AuthProvider>
    </Router>
  );
}

export default App;

