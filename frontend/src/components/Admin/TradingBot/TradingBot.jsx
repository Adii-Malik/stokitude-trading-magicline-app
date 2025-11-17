import { useState } from 'react';
import { 
  CogIcon, 
  BellIcon,
  SparklesIcon 
} from '@heroicons/react/24/outline';
import StrategyManager from './StrategyManager';
import SignalDashboard from './SignalDashboard';

export default function TradingBot() {
  const [activeTab, setActiveTab] = useState('strategies');

  const tabs = [
    { id: 'strategies', name: 'Strategies', icon: CogIcon },
    { id: 'signals', name: 'Signals', icon: BellIcon },
  ];

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Hero Section */}
      <div className="mb-8 text-center">
        <div className="flex items-center justify-center gap-3 mb-4">
          <SparklesIcon className="w-12 h-12 text-cyan-600" />
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white">
            Trading Bot
          </h1>
        </div>
        <p className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
          Configure trading strategies and monitor real-time signals
        </p>
      </div>

      {/* Tabs */}
      <div className="mb-8">
        <div className="border-b border-gray-200 dark:border-gray-700">
          <nav className="flex gap-8 justify-center" aria-label="Tabs">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`
                    flex items-center gap-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors
                    ${activeTab === tab.id
                      ? 'border-cyan-600 text-cyan-600 dark:text-cyan-400'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                    }
                  `}
                >
                  <Icon className="w-5 h-5" />
                  {tab.name}
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Tab Content */}
      <div className="mt-8">
        {activeTab === 'strategies' && <StrategyManager />}
        {activeTab === 'signals' && <SignalDashboard />}
      </div>
    </div>
  );
}
