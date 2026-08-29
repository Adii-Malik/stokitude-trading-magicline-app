import { useEffect, useState } from 'react';
import api from '../../services/api';

/**
 * The whole board, once.
 *
 * Every sector and every period arrive in a single payload, so the sector page
 * and the board share one fetch and switching period repaints rather than
 * reloads. The server holds it for five minutes; this holds it for the life of
 * the page.
 */
export function useSectors(market) {
    const [data, setData] = useState(null);
    const [error, setError] = useState(null);

    const load = () => {
        setData(null); setError(null);
        api.get('/heatmap/sectors')
            .then(({ data }) => setData(data.data))
            .catch((e) => setError(e.response?.data?.message || 'Could not load sectors'));
    };

    useEffect(load, [market]);
    return { data, error, reload: load };
}

export const money = (n) => {
    if (!n) return '—';
    if (n >= 1e12) return `${(n / 1e12).toFixed(1)}T`;
    if (n >= 1e9) return `${(n / 1e9).toFixed(1)}B`;
    if (n >= 1e6) return `${(n / 1e6).toFixed(0)}M`;
    return String(Math.round(n));
};

export const pct = (v, dp = 1) => (v == null ? '—' : `${v >= 0 ? '+' : ''}${v.toFixed(dp)}%`);

export const tone = (v) => (v == null ? 'text-gray-400'
    : v > 0 ? 'text-emerald-600 dark:text-emerald-400'
        : v < 0 ? 'text-rose-600 dark:text-rose-400' : 'text-gray-500 dark:text-gray-400');

/** A sector name in a URL. Slashes and spaces are common in PSX's list. */
export const toSlug = (sector) => encodeURIComponent(sector);
export const fromSlug = (slug) => decodeURIComponent(slug);
