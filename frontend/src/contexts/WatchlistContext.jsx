import { createContext, useContext, useCallback, useEffect, useMemo, useState } from 'react';
import api from '../services/api';
import { useAuth } from './AuthContext';
import { useMarket } from './MarketContext';
import { tally, isLive } from '../components/Watchlist/horizons';

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
    // Until the first answer lands, "no items" is ignorance, not a fact - and a
    // screen that says "nothing waiting" before it has looked is lying.
    const [loaded, setLoaded] = useState(false);
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
            setLoaded(true);
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

    /** Find a name to flag, from the board rather than only from a sector row. */
    const search = useCallback(async (q) => {
        const { data } = await api.get('/watchlist/search', { params: { q } });
        return data.data || [];
    }, []);

    const unflag = useCallback(async (id) => {
        await api.delete(`/watchlist/${id}`);
        setItems((prev) => prev.filter((i) => i.id !== id));
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

    /**
     * Drop it, put it back, or tag it.
     *
     * Replaced in place rather than removed, whichever way it went. A dropped
     * name has not stopped existing - it moved to the part of the screen that
     * answers what you passed on, and dropping the row from memory would make
     * that list wrong until the next reload.
     */
    const update = useCallback(async (id, body) => {
        const { data } = await api.patch(`/watchlist/${id}`, body);
        setItems((prev) => prev.map((i) => (i.id === id ? data.data : i)));
        return data.data;
    }, []);

    /**
     * Take a name off the queue, without ever destroying what you wrote.
     *
     * A delete is the undo for a mis-click, and a mis-click has nothing in it.
     * The moment there are looks the answer is to drop it instead, which keeps
     * the thread in history. This became load-bearing when a flag stopped being
     * per-board: the button on the yearly board now un-flags the record you
     * built on the monthly one, three notes and a chart included.
     */
    const remove = useCallback((item) => (
        item.looks?.length ? update(item.id, { state: 'dropped' }) : unflag(item.id)
    ), [update, unflag]);

    /**
     * It became a trade. The name leaves the queue - the journal is watching it
     * now, and two screens asking about the same position is how you end up
     * trusting neither - but it stays in memory as history, so the thread that
     * led to the trade is still there to read back.
     */
    const trade = useCallback(async (id, body) => {
        const { data } = await api.post(`/watchlist/${id}/trade`, body);
        setItems((prev) => prev.map((i) => (i.id === id ? data.data.watchlist : i)));
        return data.data;
    }, []);

    /**
     * Fast lookup for the sector page, which asks once per row it draws.
     *
     * Keyed on the symbol alone, matching the record. A flag is on the stock, so
     * a name flagged off the monthly board has to read as flagged on the yearly
     * one too - otherwise the button offers to flag what is already flagged, and
     * the server quietly folds the second press into the first while the screen
     * pretends something happened.
     *
     * Live names only. The button is a toggle for "am I watching this", and a
     * name you traded or passed on months ago answering yes would light up a row
     * you have already finished with.
     */
    const flagged = useMemo(() => {
        const map = new Map();
        for (const item of items) if (isLive(item)) map.set(item.symbol, item);
        return map;
    }, [items]);

    const counts = useMemo(() => tally(items), [items]);

    const value = useMemo(() => ({
        items, loading, loaded, error, reload, flag, search, unflag, remove, update, look, trade, flagged, counts,
        flagOf: (symbol) => flagged.get(symbol) || null
    }), [items, loading, loaded, error, reload, flag, search, unflag, remove, update, look, trade, flagged, counts]);

    return <WatchlistContext.Provider value={value}>{children}</WatchlistContext.Provider>;
}

export function useWatchlist() {
    const ctx = useContext(WatchlistContext);
    if (!ctx) throw new Error('useWatchlist must be used inside a WatchlistProvider');
    return ctx;
}

export default WatchlistContext;
