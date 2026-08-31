import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import { landingFor } from '../utils/market';
import { useAuth } from './AuthContext';

/**
 * Which market the app is in.
 *
 * Pakistan and the United States share a login and nothing else - different
 * broker, different tax, different calendar, different feed - and two currencies
 * that must never be added. Rather than every screen filtering by currency and
 * each having to get it right separately, the app is scoped to one market the
 * way it is scoped to one theme.
 *
 * The value lives on the user and nowhere else. There is no browser copy: the
 * server reads the market from the account, so the two cannot disagree, and a
 * stale value cannot survive a logout into somebody else's session. No screen
 * below this passes a market or a currency to anything.
 */
const MarketContext = createContext();

export const useMarket = () => {
    const context = useContext(MarketContext);
    if (!context) {
        throw new Error('useMarket must be used within MarketProvider');
    }
    return context;
};

export const MarketProvider = ({ children }) => {
    const [market, setMarketState] = useState(null);
    // Only the markets this user actually holds books in. One of them means the
    // switch has nothing to offer, so it does not appear at all.
    const [available, setAvailable] = useState([]);

    /**
     * Taken from the auth response, not fetched again.
     *
     * This used to call /auth/me itself, which AuthContext had already called -
     * the same endpoint twice on every page load, and a gap between them where
     * the market read null. Every market-scoped screen fetched once inside that
     * gap and again when it closed. The markets arrive with the user now, so
     * the scope is known the moment there is a user at all.
     */
    const { user, markets } = useAuth();
    useEffect(() => {
        if (!user || !markets) { setAvailable([]); setMarketState(null); return; }
        setAvailable(markets.held || []);
        setMarketState(markets.active || null);
    }, [user, markets]);

    // The server owns the market, so re-reading the account is the only way to
    // pick up a change made anywhere else.
    const refresh = useCallback(async () => {
        try {
            const { data } = await api.get('/auth/me');
            const next = data?.data?.markets;
            if (!next) return;
            setAvailable(next.held || []);
            setMarketState(next.active || null);
        } catch {
            // Signed out, or offline. Nothing to scope until there is a user.
        }
    }, []);

    /**
     * Switch, then start again.
     *
     * Every screen is scoped at load, so changing scope means loading again.
     * The alternative is each page subscribing to a market change and
     * remembering to refetch, which is the per-screen bookkeeping this whole
     * design exists to delete: one screen forgetting would show Pakistani
     * holdings under a US flag.
     */
    const setMarket = useCallback(async (next) => {
        if (!next || next === market) return;
        try {
            // The save has to land first: the server reads the market from the
            // account, so the reloaded page must ask as the new market from its
            // very first request.
            await api.put('/auth/market', { market: next });
        } catch {
            // Nothing was stored, so nothing is inconsistent - the app stays in
            // the market it was already in.
            return;
        }
        // A page about one book cannot survive the switch - that book is not in
        // the new market, and the server now answers 404 for it. Land on the
        // list instead of reloading onto a page that just stopped existing.
        window.location.assign(landingFor(window.location.pathname));
    }, [market]);

    const value = {
        market,
        setMarket,
        available,
        currency: available.find((m) => m.code === market)?.currency || null,
        // A switch with one option is a switch worth hiding.
        canSwitch: available.length > 1,
        refresh
    };

    return <MarketContext.Provider value={value}>{children}</MarketContext.Provider>;
};

export default MarketContext;
