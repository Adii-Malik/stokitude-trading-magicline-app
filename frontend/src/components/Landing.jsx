import React from 'react';
import { TrendingUp, LineChart, Shield, Clock, Target, Users, CheckCircle, BarChart3, Sun, Moon } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';

const Landing = ({ onSwitchToLogin, onSwitchToSignup }) => {
  const { theme, toggleTheme } = useTheme();
  const features = [
    {
      icon: <LineChart className="w-8 h-8" />,
      title: "Portfolio & SIP",
      description: "Track holdings with live profit and loss, and get monthly SIP allocation recommendations scored on fundamentals."
    },
    {
      icon: <Target className="w-8 h-8" />,
      title: "Trade Plans",
      description: "Create and manage comprehensive trade plans with entry points, targets, and stop losses."
    },
    {
      icon: <TrendingUp className="w-8 h-8" />,
      title: "Real-Time Data",
      description: "Get live stock prices and market updates directly from Pakistan Stock Exchange."
    },
    {
      icon: <BarChart3 className="w-8 h-8" />,
      title: "Advanced Analytics",
      description: "Comprehensive market analysis with volume, price changes, and trend indicators."
    },
    {
      icon: <Shield className="w-8 h-8" />,
      title: "Secure & Private",
      description: "Your trading strategies and data remain private and secure with role-based access control."
    },
    {
      icon: <Clock className="w-8 h-8" />,
      title: "Market Hours",
      description: "Stay updated with PSX market status and trading hours at a glance."
    }
  ];

  const benefits = [
    "Professional-grade trading tools",
    "Automated SIP allocation recommendations",
    "Comprehensive trade planning",
    "Portfolio tracking and management",
    "Real-time market insights",
    "Secure data storage"
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 transition-colors duration-300">
      {/* Header */}
      <header className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 shadow-lg sticky top-0 z-50">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            {/* Logo/Brand - Consistent with authenticated header */}
            <div className="flex items-center gap-2">
              <TrendingUp className="w-6 h-6 text-cyan-500" />
              <div>
                <h1 className="text-lg font-bold text-gray-900 dark:text-white">Financial Reading</h1>
                {/* Subtitle - Hidden on mobile, visible on larger screens */}
                <p className="hidden sm:block text-xs text-gray-500 dark:text-gray-400">
                  Intelligent Trading Platform
                </p>
              </div>
            </div>

            {/* Right Section - Theme + Auth Buttons */}
            <div className="flex items-center gap-2">
              {/* Theme Toggle */}
              <button
                onClick={toggleTheme}
                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
              >
                {theme === 'dark' ? (
                  <Sun className="w-5 h-5 text-yellow-500" />
                ) : (
                  <Moon className="w-5 h-5 text-gray-700 dark:text-gray-400" />
                )}
              </button>

              {/* Login Button - Text on desktop, compact on mobile */}
              <button
                onClick={onSwitchToLogin}
                className="px-3 py-1.5 text-sm bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg transition font-medium"
              >
                Login
              </button>

              {/* Sign Up Button */}
              <button
                onClick={onSwitchToSignup}
                className="px-3 py-1.5 text-sm bg-cyan-500 hover:bg-cyan-600 text-white rounded-lg transition font-medium"
              >
                Sign Up
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center">
          <div className="inline-flex items-center px-4 py-2 bg-cyan-50 dark:bg-cyan-900/30 rounded-full mb-8">
            <span className="text-cyan-600 dark:text-cyan-400 font-medium">
              🚀 Advanced Trading Tools for PSX
            </span>
          </div>

          <h2 className="text-5xl md:text-6xl font-extrabold text-gray-900 dark:text-white mb-6">
            Trade Smarter with
            <span className="block mt-2 text-cyan-600 dark:text-cyan-400">
              Financial Reading
            </span>
          </h2>

          <p className="text-xl text-gray-600 dark:text-gray-300 mb-10 max-w-3xl mx-auto">
            Your all-in-one platform for intelligent trading on the Pakistan Stock Exchange.
            Track your portfolio, create trade plans, and make data-driven decisions with confidence.
          </p>

          <div className="flex flex-col sm:flex-row justify-center space-y-4 sm:space-y-0 sm:space-x-4">
            <button
              onClick={onSwitchToSignup}
              className="px-8 py-4 bg-cyan-500 hover:bg-cyan-600 text-white text-lg rounded-lg font-semibold transition-all shadow-xl hover:shadow-2xl transform hover:-translate-y-0.5"
            >
              Get Started Free
            </button>
            <button
              onClick={onSwitchToLogin}
              className="px-8 py-4 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-lg rounded-lg font-semibold hover:bg-gray-50 dark:hover:bg-gray-700 transition-all shadow-lg border border-gray-200 dark:border-gray-700"
            >
              Sign In
            </button>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 bg-white dark:bg-gray-800 rounded-2xl shadow-xl my-10">
        <div className="text-center mb-16">
          <h3 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-4">
            Powerful Features for Serious Traders
          </h3>
          <p className="text-lg text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
            Everything you need to analyze, plan, and execute your trading strategy on PSX
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, index) => (
            <div
              key={index}
              className="p-6 rounded-xl border border-gray-200 dark:border-gray-700 hover:shadow-lg transition-all hover:border-cyan-300 dark:hover:border-cyan-600 group"
            >
              <div className="text-cyan-600 dark:text-cyan-400 mb-4 group-hover:scale-110 transition-transform">
                {feature.icon}
              </div>
              <h4 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                {feature.title}
              </h4>
              <p className="text-gray-600 dark:text-gray-400">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Why Choose Us Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div>
            <h3 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-6">
              Why Choose Financial Reading?
            </h3>
            <p className="text-lg text-gray-600 dark:text-gray-300 mb-8">
              We're building the most comprehensive and user-friendly trading platform for Pakistani traders.
              Join us on this journey and get access to professional-grade tools.
            </p>
            <div className="space-y-4">
              {benefits.map((benefit, index) => (
                <div key={index} className="flex items-start space-x-3">
                  <CheckCircle className="w-6 h-6 text-green-500 flex-shrink-0 mt-0.5" />
                  <span className="text-gray-700 dark:text-gray-300 text-lg">
                    {benefit}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-gradient-to-br from-cyan-50 to-gray-50 dark:from-cyan-900/20 dark:to-gray-900/20 p-8 rounded-2xl border border-cyan-200 dark:border-cyan-800">
            <div className="space-y-6">
              <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-gray-600 dark:text-gray-400">Active Users</span>
                  <Users className="w-5 h-5 text-cyan-500" />
                </div>
                <p className="text-3xl font-bold text-gray-900 dark:text-white">Growing Fast</p>
              </div>

              <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-gray-600 dark:text-gray-400">Trade Plans Created</span>
                  <Target className="w-5 h-5 text-cyan-500" />
                </div>
                <p className="text-3xl font-bold text-gray-900 dark:text-white">Coming Soon</p>
              </div>

              <div className="bg-white dark:bg-gray-800 p-6 rounded-xl shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-gray-600 dark:text-gray-400">Market Coverage</span>
                  <BarChart3 className="w-5 h-5 text-green-500" />
                </div>
                <p className="text-3xl font-bold text-gray-900 dark:text-white">Full PSX</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="bg-cyan-600 rounded-2xl shadow-2xl p-12 text-center">
          <h3 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Ready to Start Trading Smarter?
          </h3>
          <p className="text-xl text-cyan-100 mb-8 max-w-2xl mx-auto">
            Join Financial Reading today and get access to powerful trading tools.
            Sign up now and take control of your trading journey.
          </p>
          <button
            onClick={onSwitchToSignup}
            className="px-10 py-4 bg-white text-cyan-600 text-lg rounded-lg font-semibold hover:bg-gray-100 transition-all shadow-xl hover:shadow-2xl transform hover:-translate-y-0.5"
          >
            Create Your Free Account
          </button>
          <p className="text-cyan-100 mt-4 text-sm">
            No credit card required • Admin approval required for access
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 mt-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div className="col-span-1 md:col-span-2">
              <div className="flex items-center space-x-3 mb-4">
                <TrendingUp className="w-6 h-6 text-cyan-500" />
                <h4 className="text-xl font-bold text-gray-900 dark:text-white">
                  Financial Reading
                </h4>
              </div>
              <p className="text-gray-600 dark:text-gray-400 mb-4 max-w-md">
                Your intelligent trading companion for the Pakistan Stock Exchange.
                Professional tools for better control, privacy, and smarter trading decisions.
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-500">
                © {new Date().getFullYear()} Financial Reading. All rights reserved.
              </p>
            </div>

            <div>
              <h5 className="font-semibold text-gray-900 dark:text-white mb-4">Platform</h5>
              <ul className="space-y-2">
                <li>
                  <button
                    onClick={onSwitchToSignup}
                    className="text-gray-600 dark:text-gray-400 hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors"
                  >
                    Sign Up
                  </button>
                </li>
                <li>
                  <button
                    onClick={onSwitchToLogin}
                    className="text-gray-600 dark:text-gray-400 hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors"
                  >
                    Login
                  </button>
                </li>
                <li>
                  <span className="text-gray-400 dark:text-gray-600 cursor-not-allowed">
                    Features (Coming Soon)
                  </span>
                </li>
                <li>
                  <span className="text-gray-400 dark:text-gray-600 cursor-not-allowed">
                    Pricing (Coming Soon)
                  </span>
                </li>
              </ul>
            </div>

            <div>
              <h5 className="font-semibold text-gray-900 dark:text-white mb-4">Coming Soon</h5>
              <ul className="space-y-2 text-gray-600 dark:text-gray-400">
                <li>• Advanced charting tools</li>
                <li>• Mobile app</li>
                <li>• AI-powered insights</li>
                <li>• Portfolio analytics</li>
                <li>• Alert notifications</li>
                <li>• API access</li>
              </ul>
            </div>
          </div>

          <div className="border-t border-gray-200 dark:border-gray-700 mt-8 pt-8 text-center">
            <p className="text-sm text-gray-500 dark:text-gray-500">
              Disclaimer: Trading in stocks involves risk. Financial Reading is a tool to assist in your trading decisions.
              Always do your own research and consult with financial advisors before making investment decisions.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Landing;

