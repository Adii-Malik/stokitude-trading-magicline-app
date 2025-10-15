// MongoDB-based database for storing magic line thresholds
import Symbol from '../models/Symbol.js';

class Database {
  constructor() {
    // No need for in-memory storage anymore - using MongoDB
  }

  // Normalize symbol name (remove spaces, convert to uppercase)
  normalizeSymbol(symbol) {
    return symbol.toString().trim().replace(/\s+/g, '').toUpperCase();
  }

  // Add or update magic line threshold for a symbol
  async setSymbol(symbol, magicLine) {
    try {
      const normalized = this.normalizeSymbol(symbol);
      
      const symbolDoc = await Symbol.findOneAndUpdate(
        { symbol: normalized },
        {
          symbol: normalized,
          originalSymbol: symbol,
          magicLine: parseFloat(magicLine),
          lastUpdated: new Date()
        },
        { upsert: true, new: true }
      );
      
      return symbolDoc;
    } catch (error) {
      console.error(`Error setting symbol ${symbol}:`, error);
      throw error;
    }
  }

  // Bulk add symbols
  async bulkSetSymbols(symbolsArray) {
    try {
      const operations = symbolsArray.map(({ symbol, magicLine }) => {
        const normalized = this.normalizeSymbol(symbol);
        return {
          updateOne: {
            filter: { symbol: normalized },
            update: {
              $set: {
                symbol: normalized,
                originalSymbol: symbol,
                magicLine: parseFloat(magicLine),
                lastUpdated: new Date()
              }
            },
            upsert: true
          }
        };
      });

      const result = await Symbol.bulkWrite(operations);
      console.log(`✅ Bulk inserted/updated ${result.upsertedCount + result.modifiedCount} symbols`);
      return result;
    } catch (error) {
      console.error('Error bulk setting symbols:', error);
      throw error;
    }
  }

  // Get all symbols with their magic lines
  async getAllSymbols() {
    try {
      const symbols = await Symbol.find({}).lean();
      return symbols;
    } catch (error) {
      console.error('Error getting all symbols:', error);
      return [];
    }
  }

  // Get a specific symbol
  async getSymbol(symbol) {
    try {
      const normalized = this.normalizeSymbol(symbol);
      const symbolDoc = await Symbol.findOne({ symbol: normalized }).lean();
      return symbolDoc;
    } catch (error) {
      console.error(`Error getting symbol ${symbol}:`, error);
      return null;
    }
  }

  // Update latest price for a symbol
  async updatePrice(symbol, priceData) {
    try {
      const normalized = this.normalizeSymbol(symbol);
      
      const updated = await Symbol.findOneAndUpdate(
        { symbol: normalized },
        {
          $set: {
            currentPrice: priceData.price,
            priceData: priceData,
            lastUpdated: new Date()
          }
        },
        { new: true }
      );

      return updated;
    } catch (error) {
      console.error(`Error updating price for ${symbol}:`, error);
      return null;
    }
  }

  // Get latest price for a symbol
  async getPrice(symbol) {
    try {
      const normalized = this.normalizeSymbol(symbol);
      const symbolDoc = await Symbol.findOne({ symbol: normalized }).lean();
      return symbolDoc?.priceData || null;
    } catch (error) {
      console.error(`Error getting price for ${symbol}:`, error);
      return null;
    }
  }

  // Get all symbols with their current prices and magic lines
  async getFullData() {
    try {
      const symbols = await Symbol.find({}).lean();
      
      return symbols.map(symbolInfo => {
        const currentPrice = symbolInfo.currentPrice || null;
        const isMet = currentPrice !== null && currentPrice >= symbolInfo.magicLine;
        
        return {
          symbol: symbolInfo.symbol,
          magicLine: symbolInfo.magicLine,
          currentPrice: currentPrice,
          priceData: symbolInfo.priceData || null,
          isMet: isMet,
          addedAt: symbolInfo.createdAt,
          lastUpdated: symbolInfo.lastUpdated
        };
      });
    } catch (error) {
      console.error('Error getting full data:', error);
      return [];
    }
  }

  // Clear all symbols
  async clearSymbols() {
    try {
      const result = await Symbol.deleteMany({});
      console.log(`🗑️ Cleared ${result.deletedCount} symbols`);
      return result;
    } catch (error) {
      console.error('Error clearing symbols:', error);
      throw error;
    }
  }

  // Clear all prices (keep symbols, remove price data)
  async clearPrices() {
    try {
      const result = await Symbol.updateMany(
        {},
        {
          $set: {
            currentPrice: null,
            priceData: null
          }
        }
      );
      console.log(`🗑️ Cleared prices for ${result.modifiedCount} symbols`);
      return result;
    } catch (error) {
      console.error('Error clearing prices:', error);
      throw error;
    }
  }

  // Get statistics
  async getStats() {
    try {
      const symbols = await Symbol.find({}).lean();
      
      const totalSymbols = symbols.length;
      const metCount = symbols.filter(s => s.currentPrice !== null && s.currentPrice >= s.magicLine).length;
      const unmetCount = symbols.filter(s => s.currentPrice !== null && s.currentPrice < s.magicLine).length;
      const noDataCount = symbols.filter(s => s.currentPrice === null).length;

      return {
        totalSymbols,
        metThreshold: metCount,
        belowThreshold: unmetCount,
        noData: noDataCount
      };
    } catch (error) {
      console.error('Error getting stats:', error);
      return {
        totalSymbols: 0,
        metThreshold: 0,
        belowThreshold: 0,
        noData: 0
      };
    }
  }
}

// Export singleton instance
export default new Database();
