/**
 * Portfolio Service
 * Core business logic for portfolio management
 * Handles CRUD, holdings calculation, P/L computation, and position updates
 */
import Portfolio from '../models/Portfolio.js';
import Transaction from '../models/Transaction.js';
import Position from '../models/Position.js';
import Stock from '../models/Stock.js';
import CalculatorRegistry from './portfolio/calculators/CalculatorRegistry.js';

class PortfolioService {
    /**
     * Create a new portfolio
     */
    async createPortfolio(userId, data) {
        const portfolio = new Portfolio({
            ...data,
            owner: userId
        });

        await portfolio.save();
        return portfolio;
    }

    /**
     * Get portfolios accessible by user
     */
    async getAccessiblePortfolios(userId) {
        const portfolios = await Portfolio.find({
            $or: [
                { owner: userId },
                { 'sharedWith.user': userId }
            ],
            isActive: true
        }).populate('owner', 'username email');

        return portfolios;
    }

    /**
     * Get portfolio by ID (with access check)
     */
    async getPortfolio(portfolioId, userId) {
        const portfolio = await Portfolio.findById(portfolioId).populate('owner', 'username email');

        if (!portfolio) {
            throw new Error('Portfolio not found');
        }

        if (!portfolio.hasAccess(userId)) {
            throw new Error('Access denied');
        }

        return portfolio;
    }

    /**
     * Update portfolio
     */
    async updatePortfolio(portfolioId, userId, updates) {
        const portfolio = await this.getPortfolio(portfolioId, userId);

        if (!portfolio.canEdit(userId)) {
            throw new Error('Edit permission required');
        }

        // Prevent changing owner
        delete updates.owner;

        Object.assign(portfolio, updates);
        await portfolio.save();

        return portfolio;
    }

    /**
     * Share portfolio with another user
     */
    async sharePortfolio(portfolioId, ownerId, targetUserId, role = 'viewer') {
        const portfolio = await this.getPortfolio(portfolioId, ownerId);

        if (!portfolio.isOwnedBy(ownerId)) {
            throw new Error('Only owner can share portfolio');
        }

        // Check if already shared
        const existing = portfolio.sharedWith.find(
            share => share.user.toString() === targetUserId.toString()
        );

        if (existing) {
            existing.role = role;
            existing.sharedAt = new Date();
        } else {
            portfolio.sharedWith.push({
                user: targetUserId,
                role,
                sharedAt: new Date()
            });
        }

        await portfolio.save();
        return portfolio;
    }

    /**
     * Unshare portfolio
     */
    async unsharePortfolio(portfolioId, ownerId, targetUserId) {
        const portfolio = await this.getPortfolio(portfolioId, ownerId);

        if (!portfolio.isOwnedBy(ownerId)) {
            throw new Error('Only owner can unshare portfolio');
        }

        portfolio.sharedWith = portfolio.sharedWith.filter(
            share => share.user.toString() !== targetUserId.toString()
        );

        await portfolio.save();
        return portfolio;
    }

    /**
     * Add transaction
     */
    async addTransaction(portfolioId, userId, transactionData, options = {}) {
        const portfolio = await this.getPortfolio(portfolioId, userId);

        if (!portfolio.canEdit(userId)) {
            throw new Error('Edit permission required');
        }

        // Guard against accidental double submits and re-imports. A retried
        // request or a CSV uploaded twice would otherwise silently create a
        // second identical row and corrupt the position. Pass
        // allowDuplicate to record a genuine repeat trade.
        if (!options.allowDuplicate) {
            const existing = await this.findDuplicateTransaction(portfolioId, transactionData);
            if (existing) {
                const err = new Error(
                    `Duplicate transaction: ${transactionData.type} ${transactionData.quantity} ` +
                    `${transactionData.symbol} @ ${transactionData.price} on ` +
                    `${new Date(transactionData.executedAt).toISOString().slice(0, 10)} already exists. ` +
                    `Set allowDuplicate to record it anyway.`
                );
                err.code = 'DUPLICATE_TRANSACTION';
                err.existingId = existing._id;
                throw err;
            }
        }

        const transaction = new Transaction({
            ...transactionData,
            portfolioId,
            createdBy: userId
        });

        await transaction.save();

        // Update position
        if (['BUY', 'SELL', 'DIV'].includes(transaction.type)) {
            await this.updatePosition(portfolioId, transaction.symbol);
        }

        return transaction;
    }

    /**
     * Find an identical transaction on the same calendar day.
     * Used to reject accidental double submits and repeated CSV imports.
     * @returns {Promise<Object|null>} the existing transaction, or null
     */
    async findDuplicateTransaction(portfolioId, data) {
        if (!data.executedAt || !data.symbol || !data.type) return null;

        const day = new Date(data.executedAt);
        if (isNaN(day)) return null;

        const start = new Date(day); start.setHours(0, 0, 0, 0);
        const end = new Date(day); end.setHours(23, 59, 59, 999);

        const query = {
            portfolioId,
            symbol: String(data.symbol).toUpperCase(),
            type: data.type,
            executedAt: { $gte: start, $lte: end }
        };

        // Compare the value fields that are meaningful for this type
        for (const field of ['quantity', 'price', 'dividendCash', 'cashAmount']) {
            if (data[field] !== undefined && data[field] !== null) {
                query[field] = data[field];
            }
        }

        return Transaction.findOne(query).lean();
    }

    /**
     * Get transactions for portfolio
     */
    async getTransactions(portfolioId, userId, filters = {}) {
        await this.getPortfolio(portfolioId, userId); // Access check

        const query = { portfolioId };

        if (filters.symbol) {
            query.symbol = filters.symbol.toUpperCase();
        }

        if (filters.type) {
            query.type = filters.type;
        }

        if (filters.from || filters.to) {
            query.executedAt = {};
            if (filters.from) query.executedAt.$gte = new Date(filters.from);
            if (filters.to) query.executedAt.$lte = new Date(filters.to);
        }

        const transactions = await Transaction.find(query)
            .sort({ executedAt: -1 })
            .limit(filters.limit || 100);

        return transactions;
    }

    /**
     * Update transaction
     */
    async updateTransaction(transactionId, userId, updates) {
        const transaction = await Transaction.findById(transactionId);

        if (!transaction) {
            throw new Error('Transaction not found');
        }

        const portfolio = await this.getPortfolio(transaction.portfolioId, userId);

        if (!portfolio.canEdit(userId)) {
            throw new Error('Edit permission required');
        }

        // Prevent changing portfolio or symbol (would mess up positions)
        delete updates.portfolioId;
        delete updates.symbol;

        const oldSymbol = transaction.symbol;
        Object.assign(transaction, updates);
        await transaction.save();

        // Rebuild position for affected symbol
        await this.updatePosition(transaction.portfolioId, oldSymbol);

        return transaction;
    }

    /**
     * Delete transaction
     */
    async deleteTransaction(transactionId, userId) {
        const transaction = await Transaction.findById(transactionId);

        if (!transaction) {
            throw new Error('Transaction not found');
        }

        const portfolio = await this.getPortfolio(transaction.portfolioId, userId);

        if (!portfolio.canEdit(userId)) {
            throw new Error('Edit permission required');
        }

        const symbol = transaction.symbol;
        const portfolioId = transaction.portfolioId;

        await transaction.deleteOne();

        // Rebuild position
        await this.updatePosition(portfolioId, symbol);

        return { success: true };
    }

    /**
     * Update position for a symbol (recalculate from transactions)
     */
    async updatePosition(portfolioId, symbol) {
        symbol = symbol.toUpperCase();

        // Get portfolio to determine calculation method
        const portfolio = await Portfolio.findById(portfolioId);
        if (!portfolio) {
            throw new Error('Portfolio not found');
        }

        // Get all transactions for this symbol
        const transactions = await Transaction.find({
            portfolioId,
            symbol,
            type: { $in: ['BUY', 'SELL'] }
        }).sort({ executedAt: 1 });

        // Get current stock price
        const stock = await Stock.findOne({ symbol });
        const currentPrice = stock?.currentPrice || 0;

        // Calculate using appropriate calculator
        const calculator = CalculatorRegistry.get(portfolio.calculationMethod);
        const result = calculator.calculate(transactions, currentPrice);

        // Calculate dividends separately
        const dividendTxs = await Transaction.find({
            portfolioId,
            symbol,
            type: 'DIV'
        });

        const totalDividends = dividendTxs.reduce((sum, tx) => sum + (tx.dividendCash || 0), 0);

        // Find first purchase date
        const firstBuy = transactions.find(tx => tx.type === 'BUY');
        const firstPurchaseDate = firstBuy?.executedAt || null;

        // Find or create position
        let position = await Position.findOne({ portfolioId, symbol });

        if (!position) {
            position = new Position({ portfolioId, symbol });
        }

        // Update from calculation
        position.updateFromCalculation(result, currentPrice);
        position.dividendsReceived = totalDividends;
        position.firstPurchaseDate = firstPurchaseDate;
        position.lastTransactionAt = transactions[transactions.length - 1]?.executedAt || new Date();

        await position.save();

        return position;
    }

    /**
     * Rebuild all positions for a portfolio
     */
    async rebuildPositions(portfolioId, userId) {
        const portfolio = await this.getPortfolio(portfolioId, userId);

        if (!portfolio.canEdit(userId)) {
            throw new Error('Edit permission required');
        }

        // Get all symbols with transactions
        const symbols = await Transaction.find({ portfolioId }).distinct('symbol');

        const results = [];
        for (const symbol of symbols) {
            try {
                const position = await this.updatePosition(portfolioId, symbol);
                results.push({ symbol, status: 'success', netShares: position.netShares });
            } catch (error) {
                results.push({ symbol, status: 'error', error: error.message });
                console.error(`❌ ${symbol}: ${error.message}`);
            }
        }

        const success = results.filter(r => r.status === 'success').length;

        return results;
    }

    /**
     * Get holdings (positions with current prices)
     */
    async getHoldings(portfolioId, userId) {
        await this.getPortfolio(portfolioId, userId); // Access check

        const positions = await Position.find({
            portfolioId,
            netShares: { $gt: 0 } // Only active positions
        }).sort({ marketValue: -1 });

        // Enrich with current stock data
        const holdings = [];
        for (const position of positions) {
            const stock = await Stock.findOne({ symbol: position.symbol });
            const currentPrice = stock?.currentPrice || 0;

            // Recalculate market value and unrealized P/L with current price
            const marketValue = position.netShares * currentPrice;
            const unrealizedPnL = marketValue - position.costBasis;

            const totalPnL = unrealizedPnL + position.realizedPnL + position.dividendsReceived;
            const totalPnLPct = position.costBasis > 0 ? (totalPnL / position.costBasis) * 100 : 0;

            holdings.push({
                symbol: position.symbol,
                companyName: stock?.companyName || position.symbol,
                quantity: position.netShares,
                avgCost: position.avgCost,
                currentPrice: currentPrice,
                totalValue: marketValue,
                costBasis: position.costBasis,
                unrealizedPnL: unrealizedPnL,
                realizedPnL: position.realizedPnL,
                totalPnL,
                totalPnLPct,
                dividendsReceived: position.dividendsReceived,
                totalReturn: position.costBasis > 0 ? (totalPnL / position.costBasis) * 100 : 0,
                yieldOnCost: position.costBasis > 0 ? (position.dividendsReceived / position.costBasis) * 100 : 0,
                weightPct: 0, // Calculated below
                firstPurchaseDate: position.firstPurchaseDate
            });
        }

        // Calculate weight percentages
        const totalMarketValue = holdings.reduce((sum, h) => sum + h.totalValue, 0);
        holdings.forEach(h => {
            h.weightPct = totalMarketValue > 0
                ? (h.totalValue / totalMarketValue) * 100
                : 0;
        });

        return holdings;
    }

    /**
     * Get portfolio dashboard summary
     */
    async getDashboard(portfolioId, userId) {
        await this.getPortfolio(portfolioId, userId); // Access check

        const holdings = await this.getHoldings(portfolioId, userId);

        let totalValue = 0;
        let totalCost = 0;
        let unrealizedPnL = 0;
        let realizedPnL = 0;
        let totalDividends = 0;

        for (const holding of holdings) {
            totalValue += holding.totalValue; // Use totalValue (recalculated market value)
            totalCost += holding.costBasis;
            unrealizedPnL += holding.unrealizedPnL;
            realizedPnL += holding.realizedPnL;
            totalDividends += holding.dividendsReceived;
        }

        const totalPnL = unrealizedPnL + realizedPnL + totalDividends;
        const totalPnLPct = totalCost > 0 ? (totalPnL / totalCost) * 100 : 0;

        // Top 5 holdings by market value
        const topHoldings = holdings
            .sort((a, b) => b.totalValue - a.totalValue)
            .slice(0, 5)
            .map(h => ({
                symbol: h.symbol,
                marketValue: h.totalValue,
                weightPct: h.weightPct
            }));

        return {
            totalValue,
            totalCost,
            totalPnL,
            totalPnLPct,
            unrealizedPnL,
            realizedPnL,
            totalDividends,
            holdingsCount: holdings.length,
            topHoldings
        };
    }
}

export default new PortfolioService();
