import { useEffect, useRef } from 'react';

/**
 * TradingView's stock heatmap, embedded.
 *
 * The widget is a script tag that reads its settings from its own text content
 * and replaces itself with an iframe. It has no update path - changing a
 * setting means tearing the container down and letting it build again, which is
 * what the effect does on every dependency below.
 *
 * Its top bar is off. It carries a second set of controls saying "Perf.1M" and
 * "market_cap_basic" next to ours saying "1 month" and "company size", and two
 * sets of controls for one thing is worse than either alone.
 */
export default function TradingViewHeatmap({ dataSource, blockColor, blockSize, grouping, theme }) {
    const holder = useRef(null);

    useEffect(() => {
        const node = holder.current;
        if (!node) return;

        node.innerHTML = '';
        const script = document.createElement('script');
        script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-stock-heatmap.js';
        script.async = true;
        script.innerHTML = JSON.stringify({
            dataSource,
            blockColor,
            blockSize,
            grouping,
            colorTheme: theme === 'dark' ? 'dark' : 'light',
            locale: 'en',
            width: '100%',
            height: '100%',
            hasTopBar: false,
            isDataSetEnabled: false,
            isZoomEnabled: true,
            isSymbolTooltipEnabled: true
        });
        node.appendChild(script);

        // The iframe holds a live connection, so leaving one behind on every
        // filter change would stack them up for as long as the page is open.
        return () => { node.innerHTML = ''; };
    }, [dataSource, blockColor, blockSize, grouping, theme]);

    return <div ref={holder} className="tradingview-widget-container h-full w-full" />;
}
