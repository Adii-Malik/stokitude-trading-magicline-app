import { useState, useEffect, useCallback } from 'react';
import * as api from '../../services/api';

/**
 * Custom hook for fetching and managing portfolio data
 * Reduces duplicate code across portfolio components
 */
export function usePortfolio(portfolioId) {
    const [portfolio, setPortfolio] = useState(null);
    const [dashboard, setDashboard] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const fetchPortfolio = useCallback(async () => {
        if (!portfolioId) return;

        try {
            setLoading(true);
            setError(null);

            const [portfolioRes, dashboardRes] = await Promise.all([
                api.get(`/portfolios/${portfolioId}`),
                api.get(`/portfolios/${portfolioId}/dashboard`)
            ]);

            setPortfolio(portfolioRes.data.data);
            setDashboard(dashboardRes.data.data);
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to load portfolio');
            console.error('Error loading portfolio:', err);
        } finally {
            setLoading(false);
        }
    }, [portfolioId]);

    useEffect(() => {
        fetchPortfolio();
    }, [fetchPortfolio]);

    return { portfolio, dashboard, loading, error, refetch: fetchPortfolio };
}

/**
 * Custom hook for fetching holdings
 */
export function useHoldings(portfolioId) {
    const [holdings, setHoldings] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const fetchHoldings = useCallback(async () => {
        if (!portfolioId) return;

        try {
            setLoading(true);
            setError(null);

            const response = await api.get(`/portfolios/${portfolioId}/holdings`);
            setHoldings(response.data.data || []);
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to load holdings');
            console.error('Error loading holdings:', err);
        } finally {
            setLoading(false);
        }
    }, [portfolioId]);

    useEffect(() => {
        fetchHoldings();
    }, [fetchHoldings]);

    return { holdings, loading, error, refetch: fetchHoldings };
}

/**
 * Custom hook for allocation data (policy, SIP plan, recommendations)
 */
export function useAllocation(portfolioId) {
    const [policy, setPolicy] = useState(null);
    const [sipPlan, setSipPlan] = useState(null);
    const [recommendations, setRecommendations] = useState([]);
    const [drift, setDrift] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const fetchAllocation = useCallback(async () => {
        if (!portfolioId) return;

        try {
            setLoading(true);
            setError(null);

            const [policyRes, sipRes, recsRes, driftRes] = await Promise.allSettled([
                api.get(`/portfolios/${portfolioId}/policy`),
                api.get(`/portfolios/${portfolioId}/sip-plan`),
                api.get(`/portfolios/${portfolioId}/recommendations`),
                api.get(`/portfolios/${portfolioId}/drift`)
            ]);

            if (policyRes.status === 'fulfilled') {
                setPolicy(policyRes.value.data.data);
            }

            if (sipRes.status === 'fulfilled') {
                setSipPlan(sipRes.value.data.data);
            }

            if (recsRes.status === 'fulfilled') {
                setRecommendations(recsRes.value.data.data || []);
            }

            if (driftRes.status === 'fulfilled') {
                setDrift(driftRes.value.data.data);
            }
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to load allocation data');
            console.error('Error loading allocation:', err);
        } finally {
            setLoading(false);
        }
    }, [portfolioId]);

    useEffect(() => {
        fetchAllocation();
    }, [fetchAllocation]);

    return {
        policy,
        sipPlan,
        recommendations,
        drift,
        loading,
        error,
        refetch: fetchAllocation
    };
}

/**
 * Custom hook for portfolios list
 */
export function usePortfolioList() {
    const [portfolios, setPortfolios] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const fetchPortfolios = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);

            const response = await api.get('/portfolios');
            setPortfolios(response.data.data || []);
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to load portfolios');
            console.error('Error loading portfolios:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchPortfolios();
    }, [fetchPortfolios]);

    return { portfolios, loading, error, refetch: fetchPortfolios };
}
