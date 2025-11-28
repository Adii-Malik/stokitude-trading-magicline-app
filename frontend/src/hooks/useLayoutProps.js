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
    const [marketStatus, setMarketStatus] = useState('closed');

    useEffect(() => {
        if (!user) return;

        // Fetch market status ONCE on mount
        const fetchInitialData = async () => {
            try {
                const marketStatusRes = await api.get('/settings/market-status');
                if (marketStatusRes.data?.success) {
                    setMarketStatus(marketStatusRes.data.data.status);
                }
            } catch (error) {
                console.error('Error fetching market status:', error);
            }
        };

        fetchInitialData();

        // Setup Socket.IO for real-time updates (push-based, not poll-based)
        socketService.connect();
        setIsConnected(socketService.socket?.connected || false);

        const handleConnect = () => setIsConnected(true);
        const handleDisconnect = () => setIsConnected(false);
        const handleMarketStatus = (status) => setMarketStatus(status);

        socketService.on('connect', handleConnect);
        socketService.on('disconnect', handleDisconnect);
        socketService.on('marketStatusChange', handleMarketStatus);

        return () => {
            socketService.off('connect', handleConnect);
            socketService.off('disconnect', handleDisconnect);
            socketService.off('marketStatusChange', handleMarketStatus);
        };
    }, [user]);

    return {
        isConnected,
        marketStatus
    };
}

