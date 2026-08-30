import { createContext, useContext, useCallback, useEffect, useMemo, useState } from 'react';
import api from '../services/api';
import { useAuth } from './AuthContext';
import { useMarket } from './MarketContext';
import { tally } from '../components/Watchlist/horizons';

/**
 * The shortlist, held once for the whole app.
 *
 * Three places need it and they must agree: the header badge counts what is
 * waiting, the sector page needs to know which rows are already flagged, and the
 * shortlist screen shows the lot. Fetching per screen would let the badge say
 * three while the page shows two, which is exactly the kind of disagreement that
 * makes a nag worth ignoring.
 *
 * Scoped by market like everything else - the server answers for the market the
 * account is in, and a switch reloads the page, so this refetches with it.
 */
const WatchlistContext = createContext(null);

export function WatchlistProvider({ children }) {
    const { user } = useAuth();
    const { market } = useMarket();
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const reload = useCallback(async () => {
        if (!user) { setItems([]); return; }
        setLoading(true);
        try {
            const { data } = await api.get('/watchlist');
            setItems(data.data || []);
            setError(null);
        } catch (e) {
            setError(e.response?.data?.message || 'Could not load the shortlist');
        } finally {
            setLoading(false);
        }
    }, [user]);

    useEffect(() => { reload(); }, [reload, market]);

    /**
     * Flag a name, from wherever it was noticed.
     *
     * The server is idempotent on (symbol, period), so a double click is one
     * observation - but the new row is merged in here rather than triggering a
     * refetch, because the button that called this is waiting to turn amber.
     */
    const flag = useCallback(async (payload) => {
        const { data } = await api.post('/watchlist', payload);
        setItems((prev) => {
            const next = prev.filter((i) => i.id !== data.data.id);
            return [data.data, ...next];
        });
        return data.data;
    }, []);

    const unflag = useCallback(async (id) => {
        await api.delete(`/watchlist/${id}`);
        setItems((prev) => prev.filter((i) => i.id !== id));
    }, []);

    const update = useCallback(async (id, body) => {
        const { data } = await api.patch(`/watchlist/${id}`, body);
        setItems((prev) => (body.state === 'dropped'
            ? prev.filter((i) => i.id !== id)
            : prev.map((i) => (i.id === id ? data.data : i))));
        return data.data;
    }, []);

    /**
     * You looked at the chart. The row is replaced in place rather than
     * refetched: it keeps its position while the list is being worked, and the
     * order only settles again on the next load.
     */
    const look = useCallback(async (id, body) => {
        const { data } = await api.post(`/watchlist/${id}/looks`, body);
        setItems((prev) => prev.map((i) => (i.id === id ? data.data : i)));
        return data.data;
    }, []);

    /** Fast lookup for the sector page, which asks once per row it draws. */
    const flagged = useMemo(() => {
        const map = new Map();
        for (const item of items) map.set(`${item.symbol}|${item.period}`, item);
        return map;
    }, [items]);

    const counts = useMemo(() => tally(items), [items]);

    const value = useMemo(() => ({
        items, loading, error, reload, flag, unflag, update, look, flagged, counts,
        flagOf: (symbol, period) => flagged.get(`${symbol}|${period}`) || null
    }), [items, loading, error, reload, flag, unflag, update, look, flagged, counts]);

    return <WatchlistContext.Provider value={value}>{children}</WatchlistContext.Provider>;
}

export function useWatchlist() {
    const ctx = useContext(WatchlistContext);
    if (!ctx) throw new Error('useWatchlist must be used inside a WatchlistProvider');
    return ctx;
}

export default WatchlistContext;
