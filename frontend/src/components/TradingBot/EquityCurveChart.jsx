import { useEffect, useRef } from 'react';
import { createChart } from 'lightweight-charts';

export default function EquityCurveChart({ trades, initialCapital }) {
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

    // Calculate equity curve
    let equity = initialCapital;
    const equityData = [{
      time: new Date(trades[0].date).getTime() / 1000,
      value: initialCapital,
    }];

    trades.forEach((trade) => {
      if (trade.profit_loss !== undefined) {
        equity += trade.profit_loss;
        equityData.push({
          time: new Date(trade.date).getTime() / 1000,
          value: equity,
        });
      }
    });

    // Add area series
    const areaSeries = chart.addAreaSeries({
      topColor: 'rgba(6, 182, 212, 0.4)',
      bottomColor: 'rgba(6, 182, 212, 0.0)',
      lineColor: 'rgba(6, 182, 212, 1)',
      lineWidth: 2,
    });

    areaSeries.setData(equityData);

    // Add baseline at initial capital
    const baselineSeries = chart.addLineSeries({
      color: '#6b7280',
      lineWidth: 1,
      lineStyle: 2, // Dashed
      crosshairMarkerVisible: false,
    });

    baselineSeries.setData([
      { time: equityData[0].time, value: initialCapital },
      { time: equityData[equityData.length - 1].time, value: initialCapital },
    ]);

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
  }, [trades, initialCapital]);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
        Equity Curve
      </h3>
      <div ref={chartContainerRef} className="w-full" />
      <div className="mt-4 flex items-center justify-center gap-6 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-cyan-500 rounded-full"></div>
          <span className="text-gray-600 dark:text-gray-400">Portfolio Value</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-8 h-0.5 bg-gray-500 border-dashed"></div>
          <span className="text-gray-600 dark:text-gray-400">Initial Capital</span>
        </div>
      </div>
    </div>
  );
}
