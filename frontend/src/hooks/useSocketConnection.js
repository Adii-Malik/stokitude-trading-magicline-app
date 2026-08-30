import { useEffect } from 'react';
import socketService from '../services/socket';
import { useAuth } from '../contexts/AuthContext';

/**
 * Opens the app's one socket, for as long as somebody is signed in.
 *
 * It used to also carry two indicators into the header: whether PSX was open,
 * and whether this socket was up. The clock was a Pakistani one shown under a
 * US flag, and the connection dot was an unlabelled circle nobody read - both
 * are gone, and with them the only reason this hook returned anything.
 */
export function useSocketConnection() {
    const { user } = useAuth();

    useEffect(() => {
        if (!user) return;
        socketService.connect();
    }, [user]);
}

export default useSocketConnection;
