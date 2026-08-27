import { useEffect, useRef } from 'react';
import { createChart } from 'lightweight-charts';

export default function SignalChart({ signal }) {
  const chartContainerRef = useRef(null);
  const chartRef = useRef(null);

  useEffect(() => {
    if (!chartContainerRef.current || !signal) return;

    // Create chart
    const chart = createChart(chartContainerRef.current, {
      width: chartContainerRef.current.clientWidth,
      height: 300,
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

    // Create simplified price data around signal
    const signalTime = new Date(signal.date).getTime() / 1000;
    const priceData = [];
    
    // Generate 20 candles before and after signal
    for (let i = -20; i <= 20; i++) {
      const time = signalTime + (i * 86400); // 1 day = 86400 seconds
      const basePrice = signal.price;
      const variation = (Math.random() - 0.5) * basePrice * 0.05;
      
      priceData.push({
        time: time,
        value: basePrice + variation,
      });
    }

    // Add line series
    const lineSeries = chart.addLineSeries({
      color: '#06b6d4',
      lineWidth: 2,
    });

    lineSeries.setData(priceData);

    // Add marker for signal
    lineSeries.setMarkers([{
      time: signalTime,
      position: signal.signalType === 'BUY' ? 'belowBar' : 'aboveBar',
      color: signal.signalType === 'BUY' ? '#10b981' : '#ef4444',
      shape: signal.signalType === 'BUY' ? 'arrowUp' : 'arrowDown',
      text: `${signal.signalType} @ ${signal.price.toFixed(2)}`,
    }]);

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
  }, [signal]);

  if (!signal) {
    return null;
  }

  return (
    <div className="bg-surface rounded-control shadow-card-hover p-6">
      <h3 className="text-lg font-semibold text-ink mb-4">
        {signal.symbol} - Signal Details
      </h3>
      
      <div ref={chartContainerRef} className="w-full mb-4" />

      {/* Signal Info */}
      <div className="space-y-3">
        <div className="flex justify-between items-center p-3 bg-surface-muted rounded-control">
          <span className="text-sm text-ink-muted">Signal Type</span>
          <span className={`px-3 py-1 rounded-full text-sm font-medium ${
            signal.signalType === 'BUY'
              ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
              : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
          }`}>
            {signal.signalType}
          </span>
        </div>

        <div className="flex justify-between items-center p-3 bg-surface-muted rounded-control">
          <span className="text-sm text-ink-muted">Price</span>
          <span className="text-sm font-semibold text-ink">
            PKR {signal.price.toFixed(2)}
          </span>
        </div>

        <div className="flex justify-between items-center p-3 bg-surface-muted rounded-control">
          <span className="text-sm text-ink-muted">Strategy</span>
          <span className="text-sm font-semibold text-ink">
            {signal.strategyName}
          </span>
        </div>

        {signal.indicators && Object.keys(signal.indicators).length > 0 && (
          <div className="p-3 bg-surface-muted rounded-control">
            <p className="text-sm text-ink-muted mb-2">Indicators</p>
            <div className="space-y-1">
              {Object.entries(signal.indicators).map(([key, value]) => (
                <div key={key} className="flex justify-between text-xs">
                  <span className="text-ink-muted">
                    {key.toUpperCase()}
                  </span>
                  <span className="font-medium text-ink">
                    {typeof value === 'number' ? value.toFixed(2) : value}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {signal.reasoning && (
          <div className="p-3 bg-surface-muted rounded-control">
            <p className="text-sm text-ink-muted mb-1">Reasoning</p>
            <p className="text-sm text-ink">
              {signal.reasoning}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
