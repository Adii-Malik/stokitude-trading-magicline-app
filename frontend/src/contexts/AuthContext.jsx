import { createContext, useState, useContext, useEffect } from 'react';
import * as authAPI from '../services/auth';
import * as push from '../services/push';

const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  /**
   * The markets this account holds books in, from the same response as the user.
   *
   * /auth/me answers { user, markets } in one call. Keeping only the user meant
   * MarketContext fetched the identical endpoint again a moment later, and left
   * a window where the market was unknown - long enough for every market-scoped
   * screen to fetch once against nothing and again once it landed.
   */
  const [markets, setMarkets] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Check if user is logged in on mount
  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setLoading(false);
        return;
      }

      const response = await authAPI.getCurrentUser();
      setUser(response.data.user);
      setMarkets(response.data.markets || null);

      /**
       * Re-register this device's push subscription, once per launch.
       *
       * The browser and the server drift - a row deleted on a 410, an endpoint
       * Apple rotated - and nothing noticed, because the only check anyone made
       * was the browser asking itself. Re-sending what the browser holds repairs
       * a missing server row before an alert is lost to it.
       *
       * Here rather than on the notification screen, because a device that has
       * stopped receiving is exactly a device whose owner has no reason to go
       * looking. Deliberately not awaited: it must never delay the app opening,
       * and it fails silently by design.
       */
      push.sync();
    } catch (error) {
      console.error('Auth check failed:', error);
      localStorage.removeItem('token');
    } finally {
      setLoading(false);
    }
  };

  const login = async (email, password) => {
    try {
      setError(null);
      const response = await authAPI.login(email, password);
      const { user, token } = response.data;
      
      localStorage.setItem('token', token);
      setUser(user);
      
      return { success: true };
    } catch (error) {
      const message = error.response?.data?.message || 'Login failed';
      setError(message);
      return { success: false, error: message };
    }
  };

  const signup = async (username, email, password) => {
    try {
      setError(null);
      const response = await authAPI.signup(username, email, password);
      const { user, token, pendingApproval } = response.data;
      
      // If account is pending approval, don't log them in
      if (pendingApproval) {
        return { 
          success: true, 
          pendingApproval: true,
          message: 'Account created! Waiting for admin approval.'
        };
      }
      
      // If they have a token (immediately approved), log them in
      if (token) {
        localStorage.setItem('token', token);
        setUser(user);
      }
      
      return { success: true };
    } catch (error) {
      const message = error.response?.data?.message || 'Signup failed';
      setError(message);
      return { success: false, error: message };
    }
  };

  const logout = async () => {
    try {
      await authAPI.logout();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      localStorage.removeItem('token');
      setUser(null);
    }
  };

  const isAdmin = () => {
    return user?.role === 'admin' || user?.role === 'super_admin';
  };

  const isSuperAdmin = () => {
    return user?.role === 'super_admin';
  };

  const isActive = () => {
    return user?.isActive === true;
  };

  const value = {
    markets,
    user,
    setUser,
    loading,
    error,
    login,
    signup,
    logout,
    isAdmin,
    isSuperAdmin,
    isActive,
    isAuthenticated: !!user
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

