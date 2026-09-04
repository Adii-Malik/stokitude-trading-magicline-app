/**
 * Journal ↔ ledger link.
 *
 * A journalled trade can be booked in one of this app's portfolios. When it is,
 * the transaction ledger owns the numbers - price, size, fees - and the journal
 * keeps only what is uniquely its own: the plan, the levels, and the judgement.
 *
 * The rule that makes this safe: the journal never holds a number the ledger also
 * holds. It mints the transaction from what you typed, then reads that transaction
 * back from then on. Two copies of one fill is how the journal and the portfolio
 * came to disagree about the same trade in the first place.
 */
import Transaction from '../models/Transaction.js';
import Portfolio from '../models/Portfolio.js';
import portfolioService from './portfolioService.js';
import { pricesFor } from './quotes.js';
import { marketOfExchange, DEFAULT_MARKET } from '../config/exchanges.js';

// The stamped column when it is there, derived from the venue when it is not.
// Entries written before the market column existed have only the exchange.
const marketOf = (entry) => entry.market || marketOfExchange(entry.exchange) || DEFAULT_MARKET;

const ENTERED = new Set(['open', 'closed']);

/**
 * Fields the ledger owns once the matching leg is booked, split by how they have
 * to be compared. A date arrives from a date input as '2026-08-01' while the
 * stored value is a Date with a time on it, so comparing them as strings would
 * report a change on every save and lock out edits to the lesson.
 */
export const ENTRY_FIELDS = { numbers: ['entryPrice', 'quantity', 'fees'], dates: ['entryDate'] };
export const EXIT_FIELDS = { numbers: ['exitPrice', 'exitFees'], dates: ['exitDate'] };

const sameDay = (a, b) => {
    if (a == null || b == null) return a == null && b == null;
    const [x, y] = [new Date(a), new Date(b)];
    if (Number.isNaN(x.getTime()) || Number.isNaN(y.getTime())) return String(a) === String(b);
    return x.toISOString().slice(0, 10) === y.toISOString().slice(0, 10);
};

const sameNumber = (a, b) => {
    if (a == null || b == null) return a == null && b == null;
    return Number(a) === Number(b);
};

/** Which of a leg's owned fields the incoming body actually tries to change. */
function changedFields(entry, incoming, fields) {
    const sent = (f) => Object.prototype.hasOwnProperty.call(incoming, f);
    return [
        ...fields.numbers.filter(f => sent(f) && !sameNumber(incoming[f], entry[f])),
        ...fields.dates.filter(f => sent(f) && !sameDay(incoming[f], entry[f]))
    ];
}

const conflict = (message, code) => {
    const err = new Error(message);
    err.code = code;
    return err;
};

/**
 * Whether this entry may be booked into this portfolio at all.
 *
 * Currency is the one that matters. Every portfolio here is priced in a single
 * currency, so posting a USD fill into a PKR ledger would add dollars to rupees
 * and quietly corrupt a portfolio that currently reconciles to a real broker
 * balance. Better to refuse than to be approximately right.
 */
export function assertLinkable(entry, portfolio) {
    if (!portfolio) throw conflict('Portfolio not found', 'PORTFOLIO_NOT_FOUND');

    const entryCurrency = (entry.currency || 'PKR').toUpperCase();
    const portfolioCurrency = (portfolio.currency || 'PKR').toUpperCase();

    if (entryCurrency !== portfolioCurrency) {
        throw conflict(
            `This is a ${entryCurrency} trade and "${portfolio.name}" is a ${portfolioCurrency} portfolio. ` +
            `Book it in a ${entryCurrency} portfolio, or leave it unlinked and the journal will track it on its own.`,
            'CURRENCY_MISMATCH'
        );
    }
}

/**
 * Books whichever legs are ready and not yet booked, and records their ids.
 * Mutates the entry; the caller saves it.
 *
 * Returns the labels of what was booked, for the caller to report.
 */
export async function mintMissing(entry, userId) {
    if (!entry.portfolioId) return [];

    const portfolio = await Portfolio.findById(entry.portfolioId);
    assertLinkable(entry, portfolio);

    const booked = [];

    if (ENTERED.has(entry.state) && !entry.entryTransactionId
        && entry.entryPrice != null && entry.quantity != null && entry.entryDate) {
        entry.entryTransactionId = await book(entry, userId, {
            type: entry.direction === 'short' ? 'SELL' : 'BUY',
            quantity: entry.quantity,
            price: entry.entryPrice,
            executedAt: entry.entryDate,
            fees: entry.fees || 0
        });
        booked.push('entry');
    }

    // The exit only exists once there is an exit price. An exit date is optional:
    // trades reconstructed from statements often have a result and no date.
    if (entry.exitTransactionId == null && entry.exitPrice != null && entry.entryTransactionId) {
        entry.exitTransactionId = await book(entry, userId, {
            type: entry.direction === 'short' ? 'BUY' : 'SELL',
            quantity: entry.quantity,
            price: entry.exitPrice,
            executedAt: entry.exitDate || entry.entryDate,
            // The exit's own commission, not the entry's copied across.
            fees: entry.exitFees || 0
        });
        booked.push('exit');
    }

    return booked;
}

/**
 * Writes one leg to the ledger through the portfolio's own path, so positions
 * rebuild and permissions apply exactly as they do for a hand-entered trade.
 *
 * If the ledger already holds this fill - because it was booked in the portfolio
 * before being journalled - the existing row is adopted rather than a second one
 * written. Double-counting a trade is worse than sharing a row.
 */
async function book(entry, userId, leg) {
    const payload = {
        symbol: entry.symbol,
        notes: `Journalled trade${entry.setupType ? ` (${entry.setupType})` : ''}`,
        ...leg
    };

    try {
        const tx = await portfolioService.addTransaction(entry.portfolioId, userId, payload);
        return tx._id;
    } catch (error) {
        if (error.code === 'DUPLICATE_TRANSACTION') return error.existingId;
        throw error;
    }
}

/**
 * Refuses edits to numbers the ledger owns, and refuses to un-close a booked
 * trade. Reopening would mean deleting a real ledger row, which is not this
 * feature's call to make - correct the transaction in the portfolio instead.
 */
export function assertEditable(entry, incoming) {
    const refuse = (locked) => {
        throw conflict(
            `${locked.join(', ')} ${locked.length > 1 ? 'are' : 'is'} recorded in the portfolio ledger. ` +
            `Edit the transaction there and the journal will follow.`,
            'LEDGER_OWNED'
        );
    };

    if (entry.entryTransactionId) {
        // The portfolio a booked trade lives in cannot be changed either: the
        // transactions are already in the old one.
        const moved = Object.prototype.hasOwnProperty.call(incoming, 'portfolioId')
            && String(incoming.portfolioId || '') !== String(entry.portfolioId || '');
        if (moved) refuse(['portfolio']);

        const locked = changedFields(entry, incoming, ENTRY_FIELDS);
        if (locked.length) refuse(locked);
    }

    if (entry.exitTransactionId) {
        if (Object.prototype.hasOwnProperty.call(incoming, 'exitPrice') && incoming.exitPrice == null) {
            throw conflict(
                'This exit is booked in the portfolio ledger, so it cannot be cleared here. ' +
                'Delete the sell transaction in the portfolio if it was wrong.',
                'LEDGER_OWNED'
            );
        }

        const locked = changedFields(entry, incoming, EXIT_FIELDS);
        if (locked.length) refuse(locked);
    }
}

/**
 * Overwrites the numbers on linked entries with what the ledger actually says,
 * so a transaction edited in the portfolio shows through here without the journal
 * storing a second copy that could drift.
 *
 * Batched: one query for every linked leg across the whole list, because the
 * journal list renders every match and per-entry lookups were a round trip each.
 *
 * @param {Array} entries plain objects, already decorated or not
 */
export async function hydrate(entries) {
    // Where an open trade stands, from the poller rather than from the trader.
    // This was a field on the form asking for a price the system already knows.
    // Grouped by market, the same way the level handler does it, because a
    // symbol does not say which board it trades on and the two are two separate
    // requests. This read Stock.currentPrice, which is stamped from PSX bars
    // alone - so a US trade was never marked at all and sat at its entry price
    // for as long as it stayed open.
    const live = entries.filter(e => !e.exitPrice && e.symbol);
    if (live.length) {
        const byMarket = new Map();
        for (const entry of live) {
            const market = marketOf(entry);
            if (!byMarket.has(market)) byMarket.set(market, new Set());
            byMarket.get(market).add(entry.symbol);
        }

        const priced = new Map();
        await Promise.all([...byMarket].map(async ([market, symbols]) => {
            try {
                for (const [symbol, last] of await pricesFor([...symbols], market)) {
                    priced.set(`${market}|${symbol}`, last);
                }
            } catch (error) {
                // An unmarked open trade shows its entry price, which is what it
                // showed before this existed. Losing the whole journal to it is
                // not a trade-off worth making.
                console.error(`Could not mark ${symbols.size} open ${market} trade(s):`, error.message);
            }
        }));

        for (const entry of live) {
            const last = priced.get(`${marketOf(entry)}|${entry.symbol}`);
            if (last > 0) entry.lastPrice = last;
        }
    }

    const ids = entries.flatMap(e => [e.entryTransactionId, e.exitTransactionId].filter(Boolean));
    if (!ids.length) return entries;

    const txs = await Transaction.find({ _id: { $in: ids } })
        .select('quantity price fees otherCharges executedAt').lean();
    const byId = new Map(txs.map(t => [String(t._id), t]));

    for (const entry of entries) {
        const open = byId.get(String(entry.entryTransactionId));
        const close = byId.get(String(entry.exitTransactionId));
        if (!open && !close) continue;

        // Kept per leg, matching how the ledger charges them. computeMetrics adds
        // the two; collapsing them here would lose which side cost what.
        const cost = (tx) => Math.round(((tx.fees || 0) + (tx.otherCharges || 0)) * 100) / 100;

        if (open) {
            entry.entryPrice = open.price;
            entry.quantity = open.quantity;
            entry.entryDate = open.executedAt;
            entry.fees = cost(open);
        }

        if (close) {
            entry.exitPrice = close.price;
            entry.exitDate = close.executedAt;
            entry.exitFees = cost(close);
        }
    }

    return entries;
}
