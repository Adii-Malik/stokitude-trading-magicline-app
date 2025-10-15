import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { UserPlus, AlertCircle, Info, Shield, ArrowLeft } from 'lucide-react';

export default function Signup({ onSwitchToLogin, onBackToDashboard }) {
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
    adminCode: ''
  });
  const [showAdminCode, setShowAdminCode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const { signup } = useAuth();

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    // Validate passwords match
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    // Validate password length
    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters long');
      return;
    }

    setLoading(true);

    try {
      const result = await signup(
        formData.username,
        formData.email,
        formData.password,
        formData.adminCode || undefined
      );

      if (!result.success) {
        setError(result.error);
      } else {
        // Successfully signed up, redirect to dashboard
        if (onBackToDashboard) {
          onBackToDashboard();
        }
      }
    } catch (err) {
      setError('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 to-pink-100 px-4 py-8">
      <div className="max-w-md w-full">
        {/* Back to Dashboard Button */}
        {onBackToDashboard && (
          <button
            onClick={onBackToDashboard}
            className="mb-4 flex items-center gap-2 text-purple-600 hover:text-purple-700 font-medium transition"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </button>
        )}
        
        <div className="bg-white rounded-2xl shadow-xl p-8">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-purple-100 rounded-full mb-4">
              <UserPlus className="w-8 h-8 text-purple-600" />
            </div>
            <h2 className="text-3xl font-bold text-gray-900 mb-2">Create Account</h2>
            <p className="text-gray-600">Join PSX Monitor today</p>
          </div>

          {/* Error Alert */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm text-red-800">{error}</p>
              </div>
            </div>
          )}

          {/* Signup Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-2">
                Username
              </label>
              <input
                id="username"
                name="username"
                type="text"
                required
                value={formData.username}
                onChange={handleChange}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition"
                placeholder="Choose a username"
                disabled={loading}
              />
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                Email Address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                value={formData.email}
                onChange={handleChange}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition"
                placeholder="you@example.com"
                disabled={loading}
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                value={formData.password}
                onChange={handleChange}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition"
                placeholder="At least 6 characters"
                disabled={loading}
              />
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-2">
                Confirm Password
              </label>
              <input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                required
                value={formData.confirmPassword}
                onChange={handleChange}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition"
                placeholder="Re-enter password"
                disabled={loading}
              />
            </div>

            {/* Admin Code Toggle */}
            <div className="border-t border-gray-200 pt-4">
              <button
                type="button"
                onClick={() => setShowAdminCode(!showAdminCode)}
                className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 transition"
              >
                <Shield className="w-4 h-4" />
                {showAdminCode ? 'Hide' : 'Have an'} admin code?
              </button>

              {showAdminCode && (
                <div className="mt-3">
                  <label htmlFor="adminCode" className="block text-sm font-medium text-gray-700 mb-2">
                    Admin Code (Optional)
                  </label>
                  <input
                    id="adminCode"
                    name="adminCode"
                    type="text"
                    value={formData.adminCode}
                    onChange={handleChange}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition"
                    placeholder="Enter admin code"
                    disabled={loading}
                  />
                  <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-lg flex gap-2">
                    <Info className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-blue-800">
                      Admin accounts can upload files and delete symbols. Leave blank for regular user account.
                    </p>
                  </div>
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-purple-600 hover:bg-purple-700 text-white font-semibold py-3 px-4 rounded-lg transition duration-200 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Creating account...
                </>
              ) : (
                <>
                  <UserPlus className="w-5 h-5" />
                  Sign Up
                </>
              )}
            </button>
          </form>

          {/* Switch to Login */}
          <div className="mt-6 text-center">
            <p className="text-gray-600">
              Already have an account?{' '}
              <button
                onClick={onSwitchToLogin}
                className="text-purple-600 hover:text-purple-700 font-semibold transition"
              >
                Sign in
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

