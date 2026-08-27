import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import api from '../services/api';

/**
 * Which market the app is in.
 *
 * Pakistan and the United States share a login and nothing else - different
 * broker, different tax, different calendar, different feed - and two currencies
 * that must never be added. Rather than every screen filtering by currency and
 * each having to get it right separately, the app is scoped to one market the
 * way it is scoped to one theme.
 *
 * The value lives on the user so it survives a new device, and in localStorage
 * so the first request of a session already carries it. `api` reads that key
 * directly and sends it as X-Market on every call, which is why no screen below
 * this ever passes a market or a currency to anything.
 */
const MarketContext = createContext();

export const useMarket = () => {
    const context = useContext(MarketContext);
    if (!context) {
        throw new Error('useMarket must be used within MarketProvider');
    }
    return context;
};

const HOME = 'PK';

export const MarketProvider = ({ children }) => {
    const [market, setMarketState] = useState(() => localStorage.getItem('market') || HOME);
    // Only the markets this user actually holds books in. One of them means the
    // switch has nothing to offer, so it does not appear at all.
    const [available, setAvailable] = useState([]);

    useEffect(() => {
        localStorage.setItem('market', market);
    }, [market]);

    const refresh = useCallback(async () => {
        try {
            const { data } = await api.get('/auth/me');
            const markets = data?.data?.markets;
            if (!markets) return;
            setAvailable(markets.held || []);
            // The server is the record. A stale localStorage value - a market
            // whose last book was closed, say - is corrected here rather than
            // quietly scoping every query to nothing.
            if (markets.active && markets.active !== market) setMarketState(markets.active);
        } catch {
            // Signed out, or offline. The stored value still scopes the session.
        }
    }, [market]);

    // Once, on mount. `refresh` closes over `market` only to avoid a redundant
    // set, so re-running it whenever that changes would just re-fetch on switch.
    const first = useRef(true);
    useEffect(() => {
        if (!first.current) return;
        first.current = false;
        refresh();
    }, [refresh]);

    /**
     * Switch, then start again.
     *
     * Every screen is scoped at load - the market goes out as a header on the
     * first request each page makes - so changing scope means loading again.
     * The alternative is each page subscribing to a market change and
     * remembering to refetch, which is the per-screen bookkeeping this whole
     * design exists to delete: one screen forgetting would show Pakistani
     * holdings under a US flag.
     *
     * Written to localStorage before the reload, so the very first request of
     * the new page already carries the new market.
     */
    const setMarket = useCallback(async (next) => {
        if (!next || next === market) return;
        localStorage.setItem('market', next);
        setMarketState(next);
        try {
            await api.put('/auth/market', { market: next });
        } catch {
            // Kept locally regardless: the switch is about what you are looking
            // at now, and a failed save is not a reason to snap the view back.
        }
        window.location.reload();
    }, [market]);

    const value = {
        market,
        setMarket,
        available,
        currency: available.find((m) => m.code === market)?.currency || (market === 'PK' ? 'PKR' : 'USD'),
        // A switch with one option is a switch worth hiding.
        canSwitch: available.length > 1,
        refresh
    };

    return <MarketContext.Provider value={value}>{children}</MarketContext.Provider>;
};

export default MarketContext;
