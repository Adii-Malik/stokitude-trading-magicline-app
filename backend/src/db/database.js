// In-memory database for storing magic line thresholds
class Database {
  constructor() {
    this.symbols = new Map(); // Map<symbol, { symbol, magicLine }>
    this.latestPrices = new Map(); // Map<symbol, { price, timestamp, ... }>
  }

  // Normalize symbol name (remove spaces, convert to uppercase)
  normalizeSymbol(symbol) {
    return symbol.toString().trim().replace(/\s+/g, '').toUpperCase();
  }

  // Add or update magic line threshold for a symbol
  setSymbol(symbol, magicLine) {
    const normalized = this.normalizeSymbol(symbol);
    this.symbols.set(normalized, {
      symbol: normalized,
      originalSymbol: symbol,
      magicLine: parseFloat(magicLine),
      addedAt: new Date().toISOString()
    });
  }

  // Bulk add symbols
  bulkSetSymbols(symbolsArray) {
    symbolsArray.forEach(({ symbol, magicLine }) => {
      this.setSymbol(symbol, magicLine);
    });
  }

  // Get all symbols with their magic lines
  getAllSymbols() {
    return Array.from(this.symbols.values());
  }

  // Get a specific symbol
  getSymbol(symbol) {
    return this.symbols.get(this.normalizeSymbol(symbol));
  }

  // Update latest price for a symbol
  updatePrice(symbol, priceData) {
    const normalized = this.normalizeSymbol(symbol);
    this.latestPrices.set(normalized, {
      ...priceData,
      updatedAt: new Date().toISOString()
    });
  }

  // Get latest price for a symbol
  getPrice(symbol) {
    return this.latestPrices.get(this.normalizeSymbol(symbol));
  }

  // Get all symbols with their current prices and magic lines
  getFullData() {
    const symbols = this.getAllSymbols();
    return symbols.map(symbolInfo => {
      const price = this.getPrice(symbolInfo.symbol);
      const currentPrice = price?.price || null;
      const isMet = currentPrice !== null && currentPrice >= symbolInfo.magicLine;
      
      return {
        symbol: symbolInfo.symbol,
        magicLine: symbolInfo.magicLine,
        currentPrice: currentPrice,
        priceData: price || null,
        isMet: isMet,
        addedAt: symbolInfo.addedAt
      };
    });
  }

  // Clear all symbols
  clearSymbols() {
    this.symbols.clear();
  }

  // Clear all prices
  clearPrices() {
    this.latestPrices.clear();
  }

  // Get statistics
  getStats() {
    const fullData = this.getFullData();
    const metCount = fullData.filter(s => s.isMet).length;
    const unmetCount = fullData.filter(s => !s.isMet && s.currentPrice !== null).length;
    const noDataCount = fullData.filter(s => s.currentPrice === null).length;

    return {
      totalSymbols: this.symbols.size,
      metThreshold: metCount,
      belowThreshold: unmetCount,
      noData: noDataCount
    };
  }
}

// Export singleton instance
export default new Database();

