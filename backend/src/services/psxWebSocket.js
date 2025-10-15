import WebSocket from 'ws';
import config from '../config/config.js';
import db from '../db/database.js';

class PSXWebSocketClient {
  constructor() {
    this.ws = null;
    this.reconnectInterval = 5000;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 10;
    this.isConnecting = false;
    this.messageHandlers = [];
  }

  connect() {
    if (this.isConnecting || (this.ws && this.ws.readyState === WebSocket.OPEN)) {
      console.log('🔄 WebSocket already connected or connecting...');
      return;
    }

    this.isConnecting = true;
    console.log('🔌 Connecting to PSX Terminal WebSocket...');

    try {
      this.ws = new WebSocket(config.psxWebSocketUrl);

      this.ws.on('open', () => {
        console.log('✅ Connected to PSX Terminal WebSocket');
        this.isConnecting = false;
        this.reconnectAttempts = 0;

        // Subscribe to market data
        this.subscribe();
      });

      this.ws.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString());
          this.handleMessage(message);
        } catch (error) {
          console.error('❌ Error parsing WebSocket message:', error);
        }
      });

      this.ws.on('error', (error) => {
        console.error('❌ WebSocket error:', error.message);
        this.isConnecting = false;
      });

      this.ws.on('close', () => {
        console.log('⚠️ WebSocket connection closed');
        this.isConnecting = false;
        this.scheduleReconnect();
      });

    } catch (error) {
      console.error('❌ Error creating WebSocket connection:', error);
      this.isConnecting = false;
      this.scheduleReconnect();
    }
  }

  subscribe() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      const subscriptionMessage = {
        type: 'subscribe',
        subscriptionType: 'marketData',
        params: { marketType: 'REG' }
      };
      
      this.ws.send(JSON.stringify(subscriptionMessage));
      console.log('📡 Subscribed to REG market data');
    }
  }

  handleMessage(message) {
    // Update database with latest price
    if (message.data && message.data.symbol) {
      db.updatePrice(message.data.symbol, message.data);
    }

    // Notify all registered handlers
    this.messageHandlers.forEach(handler => handler(message));
  }

  onMessage(handler) {
    this.messageHandlers.push(handler);
  }

  scheduleReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = this.reconnectInterval * Math.min(this.reconnectAttempts, 5);
      
      console.log(`🔄 Reconnecting in ${delay / 1000}s (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
      
      setTimeout(() => {
        this.connect();
      }, delay);
    } else {
      console.error('❌ Max reconnection attempts reached. Please restart the server.');
    }
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  isConnected() {
    return this.ws && this.ws.readyState === WebSocket.OPEN;
  }
}

// Export singleton instance
export default new PSXWebSocketClient();

