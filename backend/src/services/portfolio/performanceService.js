/**
 * Portfolio performance over time.
 * Replays the ledger against daily closes; nothing here is persisted.
 */
import mongoose from 'mongoose';
import Transaction from '../../models/Transaction.js';
import PsxDaily from '../../models/PsxDaily.js';
import AverageCostCalculator from './calculators/AverageCostCalculator.js';

const ratio = new AverageCostCalculator();

/** YYYY-MM-DD in UTC, the key everything joins on. */
export const dayKey = (d) => new Date(d).toISOString().slice(0, 10);

const chargesOf = (tx) => (tx.fees || 0) + (tx.otherCharges || 0);

/**
 * One row per trading day: holdings valued at that day's close, plus cash.
 *
 * @param {Array} transactions - the full ledger, any order
 * @param {Object} prices - { SYMBOL: [{ date, close }] } ascending by date
 * @returns {Array} [{ date, value, cash, invested, total, holdings }]
 */
export function buildSeries(transactions, prices = {}) {
    const ledger = [...transactions]
        .filter(tx => tx.executedAt)
        .sort((a, b) => new Date(a.executedAt) - new Date(b.executedAt));

    if (!ledger.length) return [];

    // Days come from the price data, plus any ledger date beyond the last bar -
    // otherwise a cash movement dated after it never lands in the series while
    // still counting as a cash flow.
    const start = dayKey(ledger[0].executedAt);
    const days = [...new Set([
        ...Object.values(prices).flat().map(p => dayKey(p.date)),
        ...ledger.map(tx => dayKey(tx.executedAt))
    ])].filter(d => d >= start).sort();

    if (!days.length) return [];

    // Forward-fill: a symbol that did not trade keeps its last close.
    const cursor = {}, lastClose = {};
    for (const symbol of Object.keys(prices)) {
        cursor[symbol] = 0;
        lastClose[symbol] = 0;
    }

    const shares = {};
    let cash = 0, invested = 0, next = 0, units = 0, prevNav = 0;
    const series = [];

    for (const day of days) {
        let flow = 0;   // external money in or out today, for the NAV maths

        while (next < ledger.length && dayKey(ledger[next].executedAt) <= day) {
            const tx = ledger[next++];
            const qty = tx.quantity || 0;
            const symbol = tx.symbol;

            switch (tx.type) {
                case 'BUY':
                    shares[symbol] = (shares[symbol] || 0) + qty;
                    cash -= qty * tx.price + chargesOf(tx);
                    break;
                case 'SELL':
                    shares[symbol] = (shares[symbol] || 0) - qty;
                    cash += qty * tx.price - chargesOf(tx);
                    break;
                case 'SPLIT':
                case 'BONUS':
                    shares[symbol] = (shares[symbol] || 0) * ratio.parseRatio(tx.ratio);
                    break;
                case 'DIV':
                    cash += tx.dividendCash || 0;
                    break;
                case 'DEPOSIT':
                    cash += tx.cashAmount || 0;
                    invested += tx.cashAmount || 0;
                    flow += tx.cashAmount || 0;
                    break;
                case 'WITHDRAW':
                    cash -= tx.cashAmount || 0;
                    invested -= tx.cashAmount || 0;
                    flow -= tx.cashAmount || 0;
                    break;
                default:
                    break;
            }
        }

        for (const symbol of Object.keys(prices)) {
            const bars = prices[symbol];
            while (cursor[symbol] < bars.length && dayKey(bars[cursor[symbol]].date) <= day) {
                lastClose[symbol] = bars[cursor[symbol]++].close;
            }
        }

        let value = 0, held = 0;
        for (const [symbol, qty] of Object.entries(shares)) {
            if (qty <= 0) continue;
            value += qty * (lastClose[symbol] || 0);
            held++;
        }

        // NAV works like a fund unit price: money in buys units at the current
        // price, money out redeems them, so deposits and withdrawals move the
        // unit count and never the price. That makes it the only curve that can
        // be compared with an index or measured for drawdown.
        const total = value + cash;
        if (units === 0) {
            if (total > 0) units = total / 100;
        } else if (flow !== 0 && prevNav > 0) {
            // Priced at yesterday's close, not at a same-day figure worked out
            // by subtracting today's flow. When a day's buys were funded by that
            // same day's deposit, (total - flow) is a total the book never held -
            // on 2024-12-12 it read 2,958 against a real 4,985, and the unit
            // count carried that invented 41% loss for the rest of the series.
            units += flow / prevNav;
        }
        const nav = units > 0 ? total / units : 0;
        prevNav = nav;

        series.push({
            date: day,
            value: round(value),
            cash: round(cash),
            invested: round(invested),
            total: round(total),
            nav: round(nav),
            holdings: held
        });
    }

    return series;
}

/**
 * Largest peak-to-trough fall, measured on NAV so that deposits and
 * withdrawals do not register as gains and losses. On `total` a withdrawal
 * looks like a crash; on `value` every sale does.
 */
export function maxDrawdown(series, field = 'nav') {
    let peak = -Infinity, worst = 0, worstPct = 0, from = null, to = null, peakDate = null;

    for (const row of series) {
        const v = row[field];
        if (v > peak) {
            peak = v;
            peakDate = row.date;
        }
        const fall = peak - v;
        if (peak > 0 && fall > worst) {
            worst = fall;
            worstPct = (fall / peak) * 100;
            from = peakDate;
            to = row.date;
        }
    }

    return { amount: round(worst), pct: round(worstPct), from, to };
}

/**
 * Money-weighted annual return. Deposits are outflows for the investor,
 * withdrawals inflows, and the closing position is the final inflow - so a
 * deposit made last month is not credited with a full year of growth.
 *
 * @returns {Number|null} percent, or null when it cannot be solved
 */
export function xirr(flows, { guess = 0.1 } = {}) {
    const points = flows
        .filter(f => f.amount !== 0)
        .map(f => ({ t: new Date(f.date).getTime(), amount: f.amount }))
        .sort((a, b) => a.t - b.t);

    if (points.length < 2) return null;
    const hasIn = points.some(p => p.amount > 0);
    const hasOut = points.some(p => p.amount < 0);
    if (!hasIn || !hasOut) return null;

    const t0 = points[0].t;
    const YEAR = 365 * 24 * 60 * 60 * 1000;
    const npv = (rate) => points.reduce((sum, p) => {
        const years = (p.t - t0) / YEAR;
        return sum + p.amount / Math.pow(1 + rate, years);
    }, 0);

    // Newton first; fall back to bisection when it wanders out of range.
    let rate = guess;
    for (let i = 0; i < 60; i++) {
        const f = npv(rate);
        if (Math.abs(f) < 1e-7) return round(rate * 100);
        const slope = (npv(rate + 1e-6) - f) / 1e-6;
        if (!Number.isFinite(slope) || slope === 0) break;
        const step = f / slope;
        const nextRate = rate - step;
        if (!Number.isFinite(nextRate) || nextRate <= -0.999999) break;
        rate = nextRate;
    }

    let lo = -0.9999, hi = 10;
    if (npv(lo) * npv(hi) > 0) return null;
    for (let i = 0; i < 200; i++) {
        const mid = (lo + hi) / 2;
        if (npv(lo) * npv(mid) <= 0) hi = mid; else lo = mid;
    }
    return round(((lo + hi) / 2) * 100);
}

/** Cash flows for XIRR: capital in and out, then today's position as the close. */
export function flowsFrom(transactions, series) {
    const flows = transactions
        .filter(tx => ['DEPOSIT', 'WITHDRAW'].includes(tx.type) && tx.cashAmount)
        .map(tx => ({
            date: dayKey(tx.executedAt),
            amount: tx.type === 'DEPOSIT' ? -tx.cashAmount : tx.cashAmount
        }));

    const last = series[series.length - 1];
    if (last) flows.push({ date: last.date, amount: last.total });
    return flows;
}

/** Both rebased to 100 at the first common day. NAV, so flows do not count. */
export function rebase(series, benchmark, field = 'nav') {
    if (!series.length || !benchmark.length) return [];

    const bench = new Map(benchmark.map(b => [dayKey(b.date), b.close]));
    const rows = series.filter(r => bench.has(r.date) && r[field] > 0);
    if (!rows.length) return [];

    const baseValue = rows[0][field];
    const baseBench = bench.get(rows[0].date);
    if (!baseValue || !baseBench) return [];

    return rows.map(r => ({
        date: r.date,
        portfolio: round((r[field] / baseValue) * 100),
        benchmark: round((bench.get(r.date) / baseBench) * 100)
    }));
}

/** Everything the performance endpoint needs, in one read. */
export async function performance(portfolioId, { from, benchmark = 'KSE100' } = {}) {
    const id = new mongoose.Types.ObjectId(String(portfolioId));
    const transactions = await Transaction.find({ portfolioId: id }).lean();
    if (!transactions.length) return empty(benchmark);

    const symbols = [...new Set(transactions.map(t => t.symbol).filter(Boolean))];
    const since = from
        ? new Date(from)
        : new Date(Math.min(...transactions.map(t => new Date(t.executedAt))));

    const bars = await PsxDaily.find({
        symbol: { $in: [...symbols, benchmark] },
        date: { $gte: since }
    }).select('symbol date close').sort({ date: 1 }).lean();

    const prices = {};
    const index = [];
    for (const bar of bars) {
        if (bar.symbol === benchmark) index.push(bar);
        if (symbols.includes(bar.symbol)) (prices[bar.symbol] ||= []).push(bar);
    }

    // A held symbol with no bars is valued at zero, which sinks the series and
    // wrecks the rebased comparison. Name them rather than hide it.
    const missingPrices = symbols.filter(s => !prices[s]?.length);

    const series = buildSeries(transactions, prices);
    const flows = flowsFrom(transactions, series);
    const last = series[series.length - 1] || null;
    const capital = transactions.some(t => ['DEPOSIT', 'WITHDRAW'].includes(t.type));

    // A deposit dated after the first trade makes XIRR wildly overstate the
    // return, because the money looks like it was only present for part of it.
    const firstOf = (types) => transactions
        .filter(t => types.includes(t.type) && t.executedAt)
        .reduce((min, t) => !min || t.executedAt < min ? t.executedAt : min, null);
    const firstCapital = firstOf(['DEPOSIT']);
    const firstTrade = firstOf(['BUY', 'SELL']);
    const lateCapital = Boolean(firstCapital && firstTrade && firstCapital > firstTrade);

    return {
        series,
        comparison: rebase(series, index),
        benchmark: { symbol: benchmark, available: index.length > 0 },
        missingPrices,
        summary: {
            start: series[0]?.date || null,
            end: last?.date || null,
            value: last?.value ?? 0,
            cash: last?.cash ?? 0,
            total: last?.total ?? 0,
            invested: last?.invested ?? 0,
            // Most capital ever at work. `invested` is net of withdrawals, so it
            // understates what the return was actually earned on.
            peakInvested: series.reduce((max, r) => Math.max(max, r.invested), 0),
            // Both need recorded capital before they mean anything.
            xirrPct: capital ? xirr(flows) : null,
            capitalTracked: capital,
            lateCapital,
            drawdown: maxDrawdown(series)
        }
    };
}

function empty(benchmark) {
    return {
        series: [],
        comparison: [],
        benchmark: { symbol: benchmark, available: false },
        missingPrices: [],
        summary: {
            start: null, end: null, value: 0, cash: 0, total: 0, invested: 0,
            peakInvested: 0, xirrPct: null, capitalTracked: false, lateCapital: false,
            drawdown: { amount: 0, pct: 0, from: null, to: null }
        }
    };
}

function round(n) {
    return Math.round((n + Number.EPSILON) * 100) / 100;
}

export default { buildSeries, maxDrawdown, xirr, flowsFrom, rebase, performance };
