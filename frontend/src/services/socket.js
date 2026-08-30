import { io } from 'socket.io-client';

// Socket URL detection:
// - Production: Use window.location.origin (same domain as frontend)
// - Development: Use absolute URL with port
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL ||
  (import.meta.env.DEV ? `http://localhost:${import.meta.env.VITE_API_PORT || 5000}` : window.location.origin);

console.log('🔌 Socket URL:', SOCKET_URL);

class SocketService {
  constructor() {
    this.socket = null;
    this.listeners = new Map();
  }

  connect() {
    if (this.socket?.connected) {
      console.log('Socket already connected');
      return;
    }

    console.log('Connecting to Socket.IO server...');
    this.socket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 10
    });

    this.socket.on('connect', () => {
      console.log('✅ Connected to server via Socket.IO');
    });

    this.socket.on('disconnect', (reason) => {
      console.log('⚠️ Disconnected from server:', reason);
    });

    this.socket.on('connect_error', (error) => {
      console.error('❌ Connection error:', error);
    });
  }

  on(event, callback) {
    if (!this.socket) {
      this.connect();
    }

    this.socket.on(event, callback);

    // Store listener for cleanup
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);
  }

  off(event, callback) {
    if (this.socket) {
      this.socket.off(event, callback);
    }

    // Remove from stored listeners
    if (this.listeners.has(event)) {
      const callbacks = this.listeners.get(event);
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
    }
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.listeners.clear();
    }
  }
}

// Export singleton instance
export default new SocketService();

