import { useEffect, useRef } from 'react';
import { createChart } from 'lightweight-charts';

export default function BacktestChart({ trades, symbol }) {
  const chartContainerRef = useRef(null);
  const chartRef = useRef(null);

  useEffect(() => {
    if (!chartContainerRef.current || !trades || trades.length === 0) return;

    // Create chart
    const chart = createChart(chartContainerRef.current, {
      width: chartContainerRef.current.clientWidth,
      height: 400,
      layout: {
        background: { color: 'transparent' },
        textColor: '#9ca3af',
      },
      grid: {
        vertLines: { color: '#374151' },
        horzLines: { color: '#374151' },
      },
      crosshair: {
        mode: 1,
      },
      rightPriceScale: {
        borderColor: '#374151',
      },
      timeScale: {
        borderColor: '#374151',
        timeVisible: true,
        secondsVisible: false,
      },
    });

    chartRef.current = chart;

    // Prepare candlestick data from trades
    const candleData = [];
    const markers = [];

    trades.forEach((trade, index) => {
      const timestamp = new Date(trade.date).getTime() / 1000;
      
      // Add candle (simplified - in real scenario, you'd fetch OHLCV data)
      candleData.push({
        time: timestamp,
        open: trade.price,
        high: trade.price * 1.02,
        low: trade.price * 0.98,
        close: trade.price,
      });

      // Add marker for trade
      markers.push({
        time: timestamp,
        position: trade.type === 'BUY' ? 'belowBar' : 'aboveBar',
        color: trade.type === 'BUY' ? '#10b981' : '#ef4444',
        shape: trade.type === 'BUY' ? 'arrowUp' : 'arrowDown',
        text: `${trade.type} @ ${trade.price.toFixed(2)}`,
      });
    });

    // Add candlestick series
    const candlestickSeries = chart.addCandlestickSeries({
      upColor: '#10b981',
      downColor: '#ef4444',
      borderUpColor: '#10b981',
      borderDownColor: '#ef4444',
      wickUpColor: '#10b981',
      wickDownColor: '#ef4444',
    });

    candlestickSeries.setData(candleData);
    candlestickSeries.setMarkers(markers);

    // Handle resize
    const handleResize = () => {
      if (chartContainerRef.current) {
        chart.applyOptions({
          width: chartContainerRef.current.clientWidth,
        });
      }
    };

    window.addEventListener('resize', handleResize);

    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
    };
  }, [trades]);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
        {symbol} - Trade Signals
      </h3>
      <div ref={chartContainerRef} className="w-full" />
      <div className="mt-4 flex items-center justify-center gap-6 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-green-500 rounded-full"></div>
          <span className="text-gray-600 dark:text-gray-400">Buy Signal</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-red-500 rounded-full"></div>
          <span className="text-gray-600 dark:text-gray-400">Sell Signal</span>
        </div>
      </div>
    </div>
  );
}
