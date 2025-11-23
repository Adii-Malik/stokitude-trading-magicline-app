import { useState, useEffect } from 'react';
import socketService from '../services/socket';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';

/**
 * Custom hook that provides common layout props
 * Centralizes state management for header/layout components
 */
export function useLayoutProps() {
    const { user } = useAuth();
    const [isConnected, setIsConnected] = useState(false);
    const [lastPriceUpdate, setLastPriceUpdate] = useState(null);
    const [marketStatus, setMarketStatus] = useState('closed');

    useEffect(() => {
        if (!user) return;

        // Fetch initial data
        const fetchInitialData = async () => {
            try {
                const [marketStatusRes, lastUpdateRes] = await Promise.all([
                    api.get('/settings/market-status'),
                    api.get('/settings/last-update')
                ]);

                if (marketStatusRes.data?.success) {
                    setMarketStatus(marketStatusRes.data.data.marketStatus);
                }

                if (lastUpdateRes.data?.success && lastUpdateRes.data.data.lastUpdate) {
                    setLastPriceUpdate(lastUpdateRes.data.data.lastUpdate);
                }
            } catch (error) {
                console.error('Error fetching layout data:', error);
            }
        };

        fetchInitialData();

        // Setup Socket.IO
        socketService.connect();
        setIsConnected(socketService.socket?.connected || false);

        const handleConnect = () => setIsConnected(true);
        const handleDisconnect = () => setIsConnected(false);
        const handlePriceUpdate = (data) => {
            if (data.timestamp) {
                setLastPriceUpdate(data.timestamp);
            }
        };
        const handleMarketStatus = (status) => setMarketStatus(status);

        socketService.on('connect', handleConnect);
        socketService.on('disconnect', handleDisconnect);
        socketService.on('priceUpdate', handlePriceUpdate);
        socketService.on('marketStatusChange', handleMarketStatus);

        return () => {
            socketService.off('connect', handleConnect);
            socketService.off('disconnect', handleDisconnect);
            socketService.off('priceUpdate', handlePriceUpdate);
            socketService.off('marketStatusChange', handleMarketStatus);
        };
    }, [user]);

    return {
        isConnected,
        lastPriceUpdate,
        marketStatus
    };
}

