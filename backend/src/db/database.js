// MongoDB-based database for storing magic line thresholds
import MagicLine from '../models/MagicLine.js';
import Stock from '../models/Stock.js';

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
      
      const symbolDoc = await MagicLine.findOneAndUpdate(
        { symbol: normalized },
        {
          symbol: normalized,
          originalSymbol: symbol,
          magicLine: parseFloat(magicLine),
          isActive: true,  // ✅ Explicitly set as active
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
                isActive: true,  // ✅ Explicitly set as active
                lastUpdated: new Date()
              }
            },
            upsert: true
          }
        };
      });

      const result = await MagicLine.bulkWrite(operations);
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
      const symbols = await MagicLine.find({}).lean();
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
      const symbolDoc = await MagicLine.findOne({ symbol: normalized }).lean();
      return symbolDoc;
    } catch (error) {
      console.error(`Error getting symbol ${symbol}:`, error);
      return null;
    }
  }

  // Note: Price updates are now handled centrally by Stock model
  // Symbol model only tracks magic line thresholds and status

  // Get all symbols with their current prices and magic lines
  async getFullData() {
    try {
      const symbols = await MagicLine.find({}).lean();
      
      // 🚀 OPTIMIZED: Only fetch stocks for the symbols we need (not all stocks in DB)
      const symbolNames = symbols.map(s => s.symbol);
      const stocks = await Stock.find({ symbol: { $in: symbolNames } }).lean();
      const stockMap = {};
      stocks.forEach(stock => {
        stockMap[stock.symbol] = stock;
      });
      
      return symbols.map(symbolInfo => {
        // Read price from Stock model (centralized)
        const stock = stockMap[symbolInfo.symbol];
        const currentPrice = stock?.currentPrice || null;
        const isMet = currentPrice !== null && currentPrice >= symbolInfo.magicLine;
        
        return {
          symbol: symbolInfo.symbol,
          magicLine: symbolInfo.magicLine,
          currentPrice: currentPrice,
          priceData: stock ? {
            price: stock.currentPrice,
            change: stock.priceChange,
            changePercent: stock.priceChangePercent,  // ✅ Change % (for display instead of Trades)
            previousClose: stock.previousPrice,
            high: stock.high,           // ✅ Day High
            low: stock.low,             // ✅ Day Low
            volume: stock.volume        // ✅ Trading Volume
          } : null,
          isMet: isMet,
          addedAt: symbolInfo.createdAt,
          lastUpdated: stock?.lastUpdated || symbolInfo.lastUpdated
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
      const result = await MagicLine.deleteMany({});
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
      const result = await MagicLine.updateMany(
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
      const symbols = await MagicLine.find({}).lean();
      
      // 🚀 OPTIMIZED: Only fetch stocks for the symbols we need (not all stocks in DB)
      const symbolNames = symbols.map(s => s.symbol);
      const stocks = await Stock.find({ symbol: { $in: symbolNames } }).lean();
      const stockMap = {};
      stocks.forEach(stock => {
        stockMap[stock.symbol] = stock;
      });
      
      const totalSymbols = symbols.length;
      let metCount = 0;
      let unmetCount = 0;
      let noDataCount = 0;
      
      symbols.forEach(symbolInfo => {
        // Read price from Stock model (centralized)
        const stock = stockMap[symbolInfo.symbol];
        const currentPrice = stock?.currentPrice;
        
        if (currentPrice !== null && currentPrice !== undefined) {
          if (currentPrice >= symbolInfo.magicLine) {
            metCount++;
          } else {
            unmetCount++;
          }
        } else {
          noDataCount++;
        }
      });

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
