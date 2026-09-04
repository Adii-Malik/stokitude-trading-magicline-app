/**
 * Portfolio Service
 * Core business logic for portfolio management
 * Handles CRUD, holdings calculation, P/L computation, and position updates
 */
import mongoose from 'mongoose';
import Portfolio from '../models/Portfolio.js';
import Transaction from '../models/Transaction.js';
import Position from '../models/Position.js';
import Stock from '../models/Stock.js';
import User from '../models/User.js';

import CalculatorRegistry from './portfolio/calculators/CalculatorRegistry.js';
import { pricesFor } from './quotes.js';
import { cgtByTaxYear } from '../config/taxConfig.js';
import { getMarket, DEFAULT_MARKET } from '../config/exchanges.js';
import { currentMarket } from '../config/marketStore.js';

/**
 * What the holdings are worth right now, for whichever board the book trades on.
 *
 * Every valuation here read Stock.currentPrice, and that column is written by
 * one thing: the nightly job that stamps the last close off PSX daily bars.
 * There are no US bars, so there was no US row to read, so every US holding
 * priced at zero - and a zero price is arithmetically identical to having sold
 * the position. The book reported itself as all cash and showed each name at a
 * hundred percent loss, which is why the US screen looked empty rather than
 * broken. Nothing said a price was missing, because nothing knew.
 *
 * quotesFor already asks TradingView for the right region and falls back to the
 * warehouse, so PSX keeps the close it has always shown and US gets a price at
 * all. A symbol it cannot answer for is absent from the map rather than zero,
 * and every caller here treats absent as unpriced - never as worthless.
 */
async function bookPrices(symbols, market) {
    const wanted = [...new Set(symbols.filter(Boolean))];
    if (!wanted.length) return new Map();
    try {
        return await pricesFor(wanted, market || currentMarket() || DEFAULT_MARKET);
    } catch (error) {
        // A feed that is down must not empty the book. Nothing is priced, every
        // holding says so, and the totals say what they are missing.
        console.error(`Could not price ${wanted.length} holding(s):`, error.message);
        return new Map();
    }
}

/**
 * One position as the screen reads it, priced or not.
 *
 * Unpriced is its own state here, and every figure derived from a price is null
 * in it. Zero used to stand in, and zero is a number nothing downstream can
 * question: it made a held position worth nothing and showed it down a hundred
 * percent of its cost. Null cannot be mistaken for a valuation, and `priced`
 * says so outright so a row renders as unknown rather than as a wipeout.
 *
 * Pure and exported for its own test, because the rule it enforces - absent is
 * not zero - is the one that broke, and it broke silently.
 *
 * @param position the stored Position
 * @param stock    the warehouse row, for the company name only
 * @param price    the last price, or undefined when the feed had no answer
 */
export function shapeHolding(position, stock, price) {
    const priced = price != null;
    const marketValue = priced ? position.netShares * price : null;
    const unrealizedPnL = priced ? marketValue - position.costBasis : null;

    // Booked money is booked whether or not today has a price.
    const settled = position.realizedPnL + position.dividendsReceived;
    const totalPnL = priced ? unrealizedPnL + settled : null;
    const pctOf = (value) => (priced && position.costBasis > 0 ? (value / position.costBasis) * 100 : null);

    return {
        symbol: position.symbol,
        companyName: stock?.companyName || position.symbol,
        quantity: position.netShares,
        avgCost: position.avgCost,
        priced,
        currentPrice: priced ? price : null,
        totalValue: marketValue,
        costBasis: position.costBasis,
        unrealizedPnL,
        // Gain on shares still held; totalPnLPct mixes in sold ones.
        unrealizedPnLPct: pctOf(unrealizedPnL),
        realizedPnL: position.realizedPnL,
        totalPnL,
        totalPnLPct: pctOf(totalPnL),
        dividendsReceived: position.dividendsReceived,
        totalReturn: pctOf(totalPnL),
        yieldOnCost: position.costBasis > 0 ? (position.dividendsReceived / position.costBasis) * 100 : 0,
        weightPct: null, // A share of the book, so the caller fills it in.
        firstPurchaseDate: position.firstPurchaseDate,
        closed: position.netShares <= 0
    };
}

/**
 * What a book's returns are measured against.
 *
 * Only deposits and withdrawals move it, so only those are worth fetching: the
 * full cash walk needed all 2,076 rows on this account to arrive at one number
 * per book, and buys and sells cancel out of it entirely. Rows come in oldest
 * first, because the peak is a running maximum.
 */
export function investedBase(movements) {
    let net = 0, peak = 0, tracked = false;
    for (const tx of movements) {
        if (tx.type === 'DEPOSIT') { net += tx.cashAmount || 0; peak = Math.max(peak, net); tracked = true; }
        else if (tx.type === 'WITHDRAW') { net -= tx.cashAmount || 0; tracked = true; }
    }
    return { tracked, peakInvested: Math.round(peak * 100) / 100 };
}

/** The only fields the cash walk reads. Named once so a batch cannot select less. */
const CASH_FIELDS = 'type cashAmount quantity price fees otherCharges dividendCash executedAt portfolioId';

/**
 * Cash, walked from the transactions themselves.
 *
 * Pure and shared: the list page needs this for every book at once, and a
 * second implementation of the same switch is a second thing to keep in step.
 * Callers hand it rows already sorted oldest first.
 */
export function cashFrom(transactions) {
    let balance = 0, net = 0, peak = 0, charges = 0, tracked = false;

    for (const tx of transactions) {
        const fees = (tx.fees || 0) + (tx.otherCharges || 0);
        const cash = tx.cashAmount || 0;
        charges += fees;
        switch (tx.type) {
            case 'DEPOSIT':
                balance += cash; net += cash; peak = Math.max(peak, net); tracked = true; break;
            case 'WITHDRAW':
                balance -= cash; net -= cash; tracked = true; break;
            case 'BUY': balance -= (tx.quantity * tx.price) + fees; break;
            case 'SELL': balance += (tx.quantity * tx.price) - fees; break;
            case 'DIV': balance += tx.dividendCash || 0; break;
            default: break;
        }
    }

    const round = (n) => Math.round(n * 100) / 100;
    return { balance: round(balance), tracked, peakInvested: round(peak), fees: round(charges) };
}

class PortfolioService {
    /**
     * FBR filer status lives on the user, not the portfolio - it is a property
     * of the taxpayer and applies across every portfolio they own. Resolves
     * the owner id whether or not the portfolio's owner field is populated.
     */
    async getOwnerFilerStatus(portfolio) {
        const ownerId = portfolio.owner?._id || portfolio.owner;
        const owner = await User.findById(ownerId).select('filerStatus').lean();
        return owner?.filerStatus || 'FILER';
    }

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
    /**
     * Books this user can see.
     *
     * No market here on purpose. The model is scoped, so this returns the books
     * of whichever market the request is in - and outside a request, all of them,
     * which is what jobs and scripts want.
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
            // 404 rather than 500: a book that is not here - deleted, someone
            // else's, or in the other market - is a missing page, not a failure.
            throw Object.assign(new Error('Portfolio not found'), { status: 404 });
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

        if (transactionData.type === 'SELL') {
            const held = await this.getSharesHeld(portfolioId, transactionData.symbol);
            if (transactionData.quantity > held) {
                const err = new Error(
                    `Cannot sell ${transactionData.quantity} ${String(transactionData.symbol).toUpperCase()} ` +
                    `- only ${held} held.`
                );
                err.code = 'INSUFFICIENT_SHARES';
                err.held = held;
                throw err;
            }
        }

        const transaction = new Transaction({
            ...transactionData,
            portfolioId,
            createdBy: userId
        });

        await transaction.save();

        // Bulk imports skip this and rebuild once at the end.
        if (!options.skipPositionUpdate && ['BUY', 'SELL', 'DIV', 'SPLIT', 'BONUS'].includes(transaction.type)) {
            await this.updatePosition(portfolioId, transaction.symbol);
        }

        return transaction;
    }

    /**
     * Cash held, from the full ledger: deposits and sale proceeds and dividends
     * in, withdrawals and purchase costs out. Only meaningful once the user
     * records cash movements, so `tracked` says whether any exist.
     *
     * `peakInvested` is the most capital ever at work - the base returns should
     * be measured against, since the closing net is what is left after
     * withdrawals rather than what was put in.
     */
    /**
     * Every accessible book with the three figures the list actually draws.
     *
     * The list used to call getDashboard once per book. That computes CGT by tax
     * year, filer status, disposals, dividends and closed counts - none of which
     * a card renders - across six sequential queries each. Three books meant
     * eighteen round trips and 3.6 seconds of waiting, and it grew with every
     * book added.
     *
     * This asks four questions no matter how many books there are, and the
     * arithmetic afterwards is the same as the dashboard's so the numbers cannot
     * disagree.
     */
    async summaries(userId) {
        const portfolios = await this.getAccessiblePortfolios(userId);
        if (!portfolios.length) return [];

        const ids = portfolios.map(p => p._id);

        const [open, booked, movements] = await Promise.all([
            Position.find({ portfolioId: { $in: ids }, netShares: { $gt: 0 } })
                .select('portfolioId symbol netShares costBasis').lean(),
            Position.aggregate([
                { $match: { portfolioId: { $in: ids.map(id => new mongoose.Types.ObjectId(String(id))) } } },
                { $group: {
                    _id: '$portfolioId',
                    realizedPnL: { $sum: '$realizedPnL' },
                    dividends: { $sum: '$dividendsReceived' }
                } }
            ]),
            // Only what moves the base. The full walk would carry every buy and
            // sell across every book to reach the same two figures.
            Transaction.find({ portfolioId: { $in: ids }, type: { $in: ['DEPOSIT', 'WITHDRAW'] } })
                .select('portfolioId type cashAmount executedAt').sort({ executedAt: 1 }).lean()
        ]);

        const priceOf = await bookPrices(open.map(p => p.symbol), portfolios[0].market);

        const group = (rows, key = 'portfolioId') => rows.reduce((acc, row) => {
            const k = String(row[key]);
            (acc[k] = acc[k] || []).push(row);
            return acc;
        }, {});
        const positionsOf = group(open);
        const movementsOf = group(movements);
        const bookedOf = new Map(booked.map(b => [String(b._id), b]));

        return portfolios.map((portfolio) => {
            const id = String(portfolio._id);
            let totalValue = 0, totalCost = 0, unrealizedPnL = 0, unpriced = 0;

            for (const position of positionsOf[id] || []) {
                const price = priceOf.get(position.symbol);
                totalCost += position.costBasis;

                // Counted, not valued. Multiplying by zero would book the whole
                // position as a loss and call the card's total complete.
                if (price == null) { unpriced++; continue; }

                const marketValue = position.netShares * price;
                totalValue += marketValue;
                unrealizedPnL += marketValue - position.costBasis;
            }

            const realizedPnL = bookedOf.get(id)?.realizedPnL || 0;
            const totalDividends = bookedOf.get(id)?.dividends || 0;
            const cash = investedBase(movementsOf[id] || []);
            const totalPnL = unrealizedPnL + realizedPnL + totalDividends;

            // Same base as the dashboard: realized gains come from positions whose
            // cost is no longer in totalCost, so dividing by it credits them to
            // the open holdings.
            const base = cash.tracked && cash.peakInvested > 0 ? cash.peakInvested : totalCost;

            return {
                ...portfolio.toObject(),
                dashboardCache: {
                    // Holdings only, exactly as the dashboard reports it. Cash is
                    // a separate figure there and folding it in here would change
                    // every card's headline while claiming to be a speed-up.
                    totalValue,
                    totalCost,
                    totalPnL,
                    totalPnLPct: base > 0 ? (totalPnL / base) * 100 : 0,
                    unrealizedPnL,
                    realizedPnL,
                    totalDividends,
                    holdingsCount: (positionsOf[id] || []).length,
                    // How much of the count above the value leaves out.
                    unpricedCount: unpriced
                }
            };
        });
    }

    async getCashBalance(portfolioId) {
        const transactions = await Transaction.find({ portfolioId })
            .select(CASH_FIELDS).sort({ executedAt: 1 }).lean();
        return cashFrom(transactions);
    }

    /**
     * Insert a whole CSV in one pass. addTransaction re-reads the portfolio,
     * the duplicate index and the share count for every row, which is fine for
     * one entry and thousands of round trips for a file. Here the portfolio is
     * fetched once, existing rows are indexed once, and share counts are
     * tracked in memory as the ledger replays.
     *
     * @returns {Promise<{inserted, skipped, errors}>}
     */
    async importTransactions(portfolioId, userId, rows, importBatchId) {
        const portfolio = await this.getPortfolio(portfolioId, userId);
        if (!portfolio.canEdit(userId)) throw new Error('Edit permission required');

        const day = (d) => new Date(d).toISOString().slice(0, 10);
        const keyOf = (t) => [
            t.type, t.symbol ? String(t.symbol).toUpperCase() : '', day(t.executedAt),
            t.quantity ?? '', t.price ?? '', t.dividendCash ?? '', t.cashAmount ?? ''
        ].join('|');

        // Counted, not a Set: two identical fills on the same day at the same
        // price are two real trades. Only skip as many as the portfolio already
        // holds, so a re-import tops up rather than collapsing them.
        const existing = await Transaction.find({ portfolioId })
            .select('type symbol executedAt quantity price dividendCash cashAmount ratio')
            .sort({ executedAt: 1 }).lean();
        const already = new Map();
        for (const tx of existing) already.set(keyOf(tx), (already.get(keyOf(tx)) || 0) + 1);

        // Opening share counts, so a SELL in the file is checked against what
        // the portfolio already holds plus whatever this file has bought.
        // SPLIT and BONUS scale that count: the calculators already scale their
        // lots, and a guard that skipped them would reject every real sale made
        // after a split for holding too few shares.
        const calculator = CalculatorRegistry.get(portfolio.calculationMethod);
        const held = {};
        const applyToHeld = (tx) => {
            if (!tx.symbol) return;
            const symbol = String(tx.symbol).toUpperCase();
            if (tx.type === 'BUY') held[symbol] = (held[symbol] || 0) + (tx.quantity || 0);
            else if (tx.type === 'SELL') held[symbol] = (held[symbol] || 0) - (tx.quantity || 0);
            else if (tx.type === 'SPLIT' || tx.type === 'BONUS') {
                held[symbol] = (held[symbol] || 0) * calculator.parseRatio(tx.ratio);
            }
        };
        for (const tx of existing) applyToHeld(tx);

        const docs = [];
        const errors = [];
        let skipped = 0;

        for (const row of rows) {
            const key = keyOf(row);
            const have = already.get(key) || 0;
            if (have > 0) { already.set(key, have - 1); skipped++; continue; }

            const symbol = row.symbol ? String(row.symbol).toUpperCase() : null;
            if (row.type === 'SELL') {
                const have = held[symbol] || 0;
                if (row.quantity > have) {
                    errors.push({
                        error: `Cannot sell ${row.quantity} ${symbol} - only ${have} held.`,
                        data: row
                    });
                    continue;
                }
            }

            applyToHeld(row);

            docs.push({ ...row, portfolioId, createdBy: userId, source: 'import', importBatchId });
        }

        if (docs.length) await Transaction.insertMany(docs, { ordered: false });
        return { inserted: docs.length, skipped, errors };
    }

    /**
     * Everything about one symbol in one read: what is held, what was made,
     * what it cost in fees, and the whole ledger behind it. Fees are the part
     * no summary shows - on a name traded a dozen times they decide the result.
     */
    async symbolDetail(portfolioId, userId, symbol) {
        const portfolio = await this.getPortfolio(portfolioId, userId);
        symbol = String(symbol).toUpperCase();

        const [transactions, position, stock, priceOf] = await Promise.all([
            Transaction.find({ portfolioId, symbol }).sort({ executedAt: 1 }).lean(),
            Position.findOne({ portfolioId, symbol }).lean(),
            Stock.findOne({ symbol }).select('symbol companyName').lean(),
            bookPrices([symbol], portfolio.market)
        ]);

        if (!transactions.length) {
            const err = new Error(`No transactions for ${symbol} in this portfolio`);
            err.code = 'NOT_FOUND';
            throw err;
        }

        const sum = (rows, f) => rows.reduce((s, r) => s + (f(r) || 0), 0);
        const price = priceOf.get(symbol);
        const priced = price != null;
        const currentPrice = priced ? price : null;
        const quantity = position?.netShares || 0;
        const costBasis = position?.costBasis || 0;
        const marketValue = priced ? quantity * currentPrice : null;

        const fees = sum(transactions, t => (t.fees || 0) + (t.otherCharges || 0));
        const dividends = sum(transactions.filter(t => t.type === 'DIV'), t => t.dividendCash);
        const realized = position?.realizedPnL || 0;

        return {
            symbol,
            companyName: stock?.companyName || symbol,
            currency: portfolio.currency,
            priced,
            currentPrice,
            position: {
                quantity,
                avgCost: position?.avgCost || 0,
                costBasis,
                marketValue,
                unrealizedPnL: priced ? marketValue - costBasis : null,
                unrealizedPnLPct: priced && costBasis > 0 ? ((marketValue - costBasis) / costBasis) * 100 : null,
                firstPurchaseDate: position?.firstPurchaseDate || null
            },
            result: {
                realized,
                dividends,
                fees,
                // Fees are already inside realized via cost basis; reported so
                // the drag on a heavily traded name is visible.
                net: realized + dividends
            },
            counts: {
                buys: transactions.filter(t => t.type === 'BUY').length,
                sells: transactions.filter(t => t.type === 'SELL').length,
                dividends: transactions.filter(t => t.type === 'DIV').length
            },
            transactions
        };
    }

    /** Shares held, derived from the ledger rather than the Position view. */
    async getSharesHeld(portfolioId, symbol) {
        const portfolio = await Portfolio.findById(portfolioId).lean();
        const transactions = await Transaction.find({
            portfolioId,
            symbol: String(symbol).toUpperCase(),
            type: { $in: ['BUY', 'SELL', 'SPLIT', 'BONUS'] }
        }).lean();

        if (!transactions.length) return 0;

        const calculator = CalculatorRegistry.get(portfolio?.calculationMethod);
        return calculator.calculate(transactions, 0).netShares;
    }

    /**
     * Find an identical transaction on the same calendar day.
     * Used to reject accidental double submits and repeated CSV imports.
     * @returns {Promise<Object|null>} the existing transaction, or null
     */
    async findDuplicateTransaction(portfolioId, data) {
        if (!data.executedAt || !data.type) return null;
        // Cash movements carry no symbol; requiring one let re-imports double them.
        const cash = ['DEPOSIT', 'WITHDRAW'].includes(data.type);
        if (!cash && !data.symbol) return null;

        const day = new Date(data.executedAt);
        if (isNaN(day)) return null;

        const start = new Date(day); start.setHours(0, 0, 0, 0);
        const end = new Date(day); end.setHours(23, 59, 59, 999);

        const query = {
            portfolioId,
            type: data.type,
            executedAt: { $gte: start, $lte: end }
        };
        if (!cash) query.symbol = String(data.symbol).toUpperCase();

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
        // Cash movements have no instrument, so there is no position to rebuild.
        if (!symbol) return null;
        symbol = symbol.toUpperCase();

        // Get portfolio to determine calculation method
        const portfolio = await Portfolio.findById(portfolioId);
        if (!portfolio) {
            // 404 rather than 500: a book that is not here - deleted, someone
            // else's, or in the other market - is a missing page, not a failure.
            throw Object.assign(new Error('Portfolio not found'), { status: 404 });
        }

        // Get all transactions for this symbol
        const transactions = await Transaction.find({
            portfolioId,
            symbol,
            type: { $in: ['BUY', 'SELL', 'SPLIT', 'BONUS'] }
        }).sort({ executedAt: 1 });

        // The snapshot stored on the position. Zero when the feed cannot answer,
        // because the stored fields are numbers - the read paths recompute from
        // a live quote and are the ones that report a holding as unpriced.
        const currentPrice = (await bookPrices([symbol], portfolio.market)).get(symbol) || 0;

        // Calculate using appropriate calculator. Filer status is a property of
        // the taxpayer, so it comes off the owner rather than the portfolio.
        const filerStatus = await this.getOwnerFilerStatus(portfolio);
        const calculator = CalculatorRegistry.get(portfolio.calculationMethod);
        const result = calculator.calculate(transactions, currentPrice, {
            filerStatus
        });

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

        // Everything this needs, read once: updatePosition per symbol was six
        // round trips each, which on a large portfolio outran the request.
        const [transactions, positions] = await Promise.all([
            Transaction.find({ portfolioId }).sort({ executedAt: 1 }),
            Position.find({ portfolioId })
        ]);

        const bySymbol = new Map();
        for (const tx of transactions) {
            if (!tx.symbol) continue;   // cash movements have no instrument
            const symbol = tx.symbol.toUpperCase();
            if (!bySymbol.has(symbol)) bySymbol.set(symbol, []);
            bySymbol.get(symbol).push(tx);
        }

        const priceOf = await bookPrices([...bySymbol.keys()], portfolio.market);
        const existing = new Map(positions.map(p => [p.symbol, p]));
        const calculator = CalculatorRegistry.get(portfolio.calculationMethod);
        const filerStatus = await this.getOwnerFilerStatus(portfolio);

        const results = [];
        const saves = [];
        for (const [symbol, txs] of bySymbol) {
            try {
                const currentPrice = priceOf.get(symbol) || 0;
                const trades = txs.filter(t => ['BUY', 'SELL', 'SPLIT', 'BONUS'].includes(t.type));
                const result = calculator.calculate(trades, currentPrice, {
                    filerStatus
                });

                const position = existing.get(symbol) || new Position({ portfolioId, symbol });
                position.updateFromCalculation(result, currentPrice);
                position.dividendsReceived = txs
                    .filter(t => t.type === 'DIV')
                    .reduce((sum, t) => sum + (t.dividendCash || 0), 0);
                position.firstPurchaseDate = trades.find(t => t.type === 'BUY')?.executedAt || null;
                position.lastTransactionAt = trades[trades.length - 1]?.executedAt || new Date();

                saves.push(position.save());
                results.push({ symbol, status: 'success', netShares: position.netShares });
            } catch (error) {
                results.push({ symbol, status: 'error', error: error.message });
                console.error(`❌ ${symbol}: ${error.message}`);
            }
        }

        await Promise.all(saves);
        return results;
    }

    /**
     * Get holdings (positions with current prices)
     */
    async getHoldings(portfolioId, userId, { includeClosed = false, authorized = false, market = null } = {}) {
        if (!authorized) market = (await this.getPortfolio(portfolioId, userId)).market;

        const query = { portfolioId };
        if (!includeClosed) query.netShares = { $gt: 0 };
        const positions = await Position.find(query).sort({ marketValue: -1 }).lean();

        const symbols = positions.map(p => p.symbol);
        // The name is warehoused, the price is not. Both are asked for at once,
        // and a name we do not hold falls back to the symbol as it always has.
        const [stocks, priceOf] = await Promise.all([
            Stock.find({ symbol: { $in: symbols } }).select('symbol companyName').lean(),
            bookPrices(symbols, market)
        ]);
        const bySymbol = new Map(stocks.map(s => [s.symbol, s]));

        const holdings = positions.map(position =>
            shapeHolding(position, bySymbol.get(position.symbol), priceOf.get(position.symbol)));

        // Weights are a share of what could be valued. An unpriced holding has
        // no share to state, so it gets null rather than a zero that would read
        // as "none of the book".
        const totalMarketValue = holdings.reduce((sum, h) => sum + (h.totalValue || 0), 0);
        holdings.forEach(h => {
            h.weightPct = h.priced && totalMarketValue > 0
                ? (h.totalValue / totalMarketValue) * 100
                : null;
        });

        return holdings;
    }

    /**
     * Get portfolio dashboard summary
     */
    async getDashboard(portfolioId, userId) {
        const portfolio = await this.getPortfolio(portfolioId, userId); // Access check

        /**
         * Only where this app has a tax model. A US book showed no tax purely
         * because AVERAGE_COST records no disposals - switch it to FIFO, which
         * does track lots, and it would have started charging Pakistani NCCPL
         * rates on US trades without anything saying so. The market decides,
         * rather than whichever calculator happened to be selected.
         */
        const taxed = getMarket(portfolio.market).capitalGains;

        /**
         * Five independent reads, run together rather than one after another.
         *
         * They were sequential, and none of them needed the one before it -
         * every one takes only the portfolio id and the document already
         * fetched above. On a real book that was 850ms of waiting for work that
         * could all have been in flight at once, and the cash balance alone -
         * which walks the whole transaction ledger - accounted for 480ms of it.
         */
        const [holdings, booked, withDisposals, cash, filerStatus] = await Promise.all([
            this.getHoldings(portfolioId, userId, { authorized: true, market: portfolio.market }),

            // Realized P/L and dividends outlive the position, so total them
            // across every position rather than only the open ones.
            Position.aggregate([
                { $match: { portfolioId: new mongoose.Types.ObjectId(String(portfolioId)) } },
                {
                    $group: {
                        _id: null,
                        realizedPnL: { $sum: '$realizedPnL' },
                        dividends: { $sum: '$dividendsReceived' },
                        cgtTax: { $sum: '$cgtTax' },
                        closed: { $sum: { $cond: [{ $lte: ['$netShares', 0] }, 1, 0] } },

                        /**
                         * How often booking a result went your way, and by how
                         * much when it did.
                         *
                         * Home had a panel apologising that expectancy stays
                         * blank until the journal has closed trades, while the
                         * ledger already knew: a name whose realized P/L is not
                         * zero has had its answer. Counting the two sides and
                         * summing each separately is enough for a win rate and
                         * the ratio of the average win to the average loss,
                         * which together say more than either alone - you can
                         * be wrong most of the time and still make money.
                         */
                        won: { $sum: { $cond: [{ $gt: ['$realizedPnL', 0] }, 1, 0] } },
                        lost: { $sum: { $cond: [{ $lt: ['$realizedPnL', 0] }, 1, 0] } },
                        wonSum: { $sum: { $cond: [{ $gt: ['$realizedPnL', 0] }, '$realizedPnL', 0] } },
                        lostSum: { $sum: { $cond: [{ $lt: ['$realizedPnL', 0] }, '$realizedPnL', 0] } }
                    }
                }
            ]),

            // Loss relief nets across every symbol and carries between tax
            // years, so the disposals have to be gathered before the tax can be
            // worked out. Summing each position's own cgtTax taxed gross gains
            // and ignored every loss, which on a book that churns overstates
            // the bill several times over.
            taxed
                ? Position.find({ portfolioId, 'disposals.0': { $exists: true } }).select('disposals').lean()
                : [],

            this.getCashBalance(portfolioId),

            // Filer status is a Pakistani thing; it means nothing on a US book.
            taxed ? this.getOwnerFilerStatus(portfolio) : null
        ]);

        let totalValue = 0;
        let totalCost = 0;
        let unrealizedPnL = 0;

        // What the feed could not answer for. Named rather than counted: the one
        // useful thing to say about a holding with no price is which one it is.
        const unpriced = holdings.filter(h => !h.priced).map(h => h.symbol);

        for (const holding of holdings) {
            totalCost += holding.costBasis;
            if (!holding.priced) continue;
            totalValue += holding.totalValue; // Use totalValue (recalculated market value)
            unrealizedPnL += holding.unrealizedPnL;
        }

        const realizedPnL = booked[0]?.realizedPnL || 0;
        const totalDividends = booked[0]?.dividends || 0;
        const closedCount = booked[0]?.closed || 0;

        const disposals = withDisposals.flatMap(p => p.disposals || []);
        const cgtYears = taxed ? cgtByTaxYear(disposals) : [];
        const holdingPeriodCGT = Math.round(cgtYears.reduce((sum, y) => sum + y.tax, 0) * 100) / 100;

        const totalPnL = unrealizedPnL + realizedPnL + totalDividends;

        // Realized P/L comes from positions no longer held, whose cost is not in
        // totalCost - dividing by it credits those gains to the open holdings.
        // Capital deposited is the honest base; fall back when cash is untracked.
        const base = cash.tracked && cash.peakInvested > 0 ? cash.peakInvested : totalCost;
        const totalPnLPct = base > 0 ? (totalPnL / base) * 100 : 0;

        // Tax falls on realised gains only, and only when there are gains.
        // Dividends arrive already withheld, so taxing them here double-counts.
        //
        // Two estimates: the flat taxRatePct (legacy, method-agnostic) and the
        // holding-period CGT the FIFO calculator sums per disposal, honouring
        // PSX's 12-month/24-month tiers and filer status. When lots are tracked
        // the tiered figure is the accurate one - NCCPL deducts it per disposal
        // at settlement - so it drives the net; otherwise fall back to flat.
        const taxRatePct = taxed ? (portfolio.taxRatePct ?? 15) : null;
        const flatCGT = realizedPnL > 0 ? (realizedPnL * (taxRatePct ?? 0)) / 100 : 0;
        const usesLotTax = disposals.length > 0;
        const capitalGainsTax = taxed ? (usesLotTax ? holdingPeriodCGT : flatCGT) : 0;
        const netRealizedPnL = realizedPnL - capitalGainsTax;

        // Top 5 holdings by market value. Unpriced ones cannot be ranked by a
        // value they do not have, so they sort last rather than as zero.
        const topHoldings = holdings
            .filter(h => h.priced)
            .sort((a, b) => b.totalValue - a.totalValue)
            .slice(0, 5)
            .map(h => ({
                symbol: h.symbol,
                marketValue: h.totalValue,
                weightPct: h.weightPct
            }));

        /**
         * Every holding, by value, for callers that combine several books.
         *
         * `weightPct` is a share of this portfolio alone, so a screen showing
         * two books cannot add them: 30% of a small account would outrank 20%
         * of a large one though it is a twentieth of the size. Value is the
         * same unit in every book of a market, so the caller sums first and
         * divides once. Symbol and number only - anything richer belongs to the
         * holdings endpoint.
         */
        const holdingValues = holdings.filter(h => h.priced).map(h => ({ symbol: h.symbol, value: h.totalValue }));

        /**
         * What booking a result has come to, over every name that has one.
         *
         * Counted per symbol rather than per round trip: a name traded four
         * times is one answer to "was I right about this", which is the
         * question. Averages rather than totals, because the ratio between them
         * is the part that explains a losing hit rate that still makes money.
         */
        const won = booked[0]?.won || 0;
        const lost = booked[0]?.lost || 0;
        const results = {
            won,
            lost,
            decided: won + lost,
            // Sums, not averages. A caller combining two books can add these;
            // averaging two averages weights a four-name book like a forty-name
            // one. The division belongs wherever the totals stop growing.
            wonSum: booked[0]?.wonSum || 0,
            lostSum: Math.abs(booked[0]?.lostSum || 0)
        };

        return {
            totalValue,
            totalCost,
            totalPnL,
            totalPnLPct,
            unrealizedPnL,
            realizedPnL,
            totalDividends,
            taxRatePct,
            capitalGainsTax,
            holdingPeriodCGT,
            cgtMethod: usesLotTax ? 'HOLDING_PERIOD' : 'FLAT',
            // Per year, so the figure can be checked against a filing rather than
            // taken on trust, and so unused losses are visible.
            cgtByYear: cgtYears,
            filerStatus,
            netRealizedPnL,

            // Already inside realizedPnL via cost basis - shown so the drag is
            // visible, not as a further deduction.
            totalFees: cash.fees,
            cashBalance: cash.balance,
            cashTracked: cash.tracked,
            holdingsCount: holdings.length,
            /**
             * Which holdings the total above leaves out.
             *
             * Every figure here is stated as though it covered the whole book,
             * and until this existed there was no way for a screen to know it
             * did not. A caller that shows totalValue is expected to show this
             * beside it - a value missing four names is a different number from
             * the same value with nothing missing.
             */
            unpriced,
            closedCount,
            topHoldings,
            holdingValues,
            results
        };
    }
}

export default new PortfolioService();
