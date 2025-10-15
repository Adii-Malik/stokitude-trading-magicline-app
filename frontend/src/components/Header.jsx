import { TrendingUp, Activity } from 'lucide-react';

export default function Header({ stats, isConnected }) {
  return (
    <header className="bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg">
      <div className="container mx-auto px-4 py-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <TrendingUp className="w-8 h-8" />
            <div>
              <h1 className="text-2xl font-bold">PSX Magic Line Monitor</h1>
              <p className="text-blue-100 text-sm">Real-time stock price monitoring</p>
            </div>
          </div>

          <div className="flex items-center gap-6">
            {/* Connection Status */}
            <div className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`} />
              <span className="text-sm font-medium">
                {isConnected ? 'Connected' : 'Disconnected'}
              </span>
            </div>

            {/* Stats */}
            {stats && (
              <div className="hidden sm:flex items-center gap-6 bg-white/10 backdrop-blur px-4 py-2 rounded-lg">
                <div className="text-center">
                  <div className="text-xl font-bold">{stats.totalSymbols}</div>
                  <div className="text-xs text-blue-100">Total</div>
                </div>
                <div className="text-center">
                  <div className="text-xl font-bold text-green-300">{stats.metThreshold}</div>
                  <div className="text-xs text-blue-100">Met</div>
                </div>
                <div className="text-center">
                  <div className="text-xl font-bold text-yellow-300">{stats.belowThreshold}</div>
                  <div className="text-xs text-blue-100">Below</div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

