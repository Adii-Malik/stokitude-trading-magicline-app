import 'dotenv/config';
import mongoose from 'mongoose';
import { connectDB } from '../config/mongodb.js';
import config from '../config/config.js';
import psxScraper from '../services/psxScraper.js';

/**
 * Checks the heatmap against sources that could contradict it.
 *
 * The heatmap is TradingView's, so checking it against our own bars proves
 * little - those came from TradingView too. PSX's own data portal did not, so
 * that is the check that can actually fail.
 *
 * Two questions, because they have different answers:
 *
 *   Are the prices right?   Against dps.psx.com.pk. Nothing subjective here -
 *                           either the number matches the exchange or it does not.
 *
 *   Are the returns right?  Against our own bars, over 21 trading days, which is
 *                           the convention TradingView's Perf.1M follows. What is
 *                           left after that is dividend adjustment, and it is not
 *                           an error - see below.
 *
 *   node src/scripts/validateHeatmap.js
 *   node src/scripts/validateHeatmap.js OGDC LUCK FFC
 */
const SAMPLE = process.argv.slice(2).length
    ? process.argv.slice(2).map(s => s.toUpperCase())
    : ['OGDC', 'MEBL', 'LUCK', 'FFC', 'PSO', 'MARI', 'PPL', 'ATRL', 'NCL', 'EFERT'];

/** The lookback that reproduces Perf.1M, measured rather than assumed. */
const TRADING_DAYS_IN_A_MONTH = 21;
const PRICE_TOLERANCE_PCT = 0.5;
const RETURN_TOLERANCE_POINTS = 1.5;

async function fromTradingView(symbols) {
    const res = await fetch('https://scanner.tradingview.com/pakistan/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'User-Agent': 'Mozilla/5.0' },
        body: JSON.stringify({
            filter: [{ left: 'exchange', operation: 'equal', right: 'PSX' },
                     { left: 'name', operation: 'in_range', right: symbols }],
            columns: ['name', 'close', 'change', 'Perf.W', 'Perf.1M'],
            range: [0, 200]
        })
    });
    if (!res.ok) throw new Error(`TradingView scanner returned ${res.status}`);
    const body = await res.json();
    return new Map((body.data || []).map(r => [r.d[0], { close: r.d[1], change: r.d[2], w: r.d[3], m: r.d[4] }]));
}

const run = async () => {
    await connectDB(config.mongoUri);
    const bars = mongoose.connection.db.collection('psxdailies');
    const tv = await fromTradingView(SAMPLE);
    console.log(`\nTradingView answered for ${tv.size} of ${SAMPLE.length} symbols\n`);

    console.log('1) PRICE, against PSX\'s own data portal');
    console.log('   symbol      TradingView      PSX official      diff');
    let priced = 0, matched = 0;
    for (const symbol of SAMPLE) {
        const t = tv.get(symbol);
        if (!t) { console.log(`   ${symbol.padEnd(11)} not listed on TradingView`); continue; }
        let official = null;
        try { official = await psxScraper.getStockPrice(symbol); } catch { /* handled below */ }
        if (!official?.price) { console.log(`   ${symbol.padEnd(11)} PSX portal returned nothing`); continue; }
        priced++;
        const gap = Math.abs((t.close - official.price) / official.price * 100);
        if (gap <= PRICE_TOLERANCE_PCT) matched++;
        console.log(`   ${symbol.padEnd(11)} ${String(t.close).padStart(11)} ${String(official.price).padStart(17)}`
            + `   ${(t.close - official.price).toFixed(2).padStart(8)}  ${gap <= PRICE_TOLERANCE_PCT ? 'ok' : 'MISMATCH'}`);
    }
    console.log(`   -> ${matched} of ${priced} within ${PRICE_TOLERANCE_PCT}%\n`);

    console.log(`2) ONE-MONTH RETURN, against our own bars over ${TRADING_DAYS_IN_A_MONTH} trading days`);
    console.log('   symbol      TradingView       ours      diff');
    const wide = [];
    let compared = 0, close = 0;
    for (const symbol of SAMPLE) {
        const t = tv.get(symbol);
        if (!t) continue;
        const rows = await bars.find({ symbol }).sort({ date: -1 }).limit(TRADING_DAYS_IN_A_MONTH + 5).toArray();
        if (rows.length <= TRADING_DAYS_IN_A_MONTH) {
            console.log(`   ${symbol.padEnd(11)} only ${rows.length} bars stored - not enough to judge`);
            continue;
        }
        const then = rows[TRADING_DAYS_IN_A_MONTH].close;
        const ours = (rows[0].close - then) / then * 100;
        const diff = t.m - ours;
        compared++;
        if (Math.abs(diff) <= RETURN_TOLERANCE_POINTS) close++; else wide.push({ symbol, diff });
        console.log(`   ${symbol.padEnd(11)} ${t.m.toFixed(2).padStart(11)} ${ours.toFixed(2).padStart(10)}`
            + `   ${diff.toFixed(2).padStart(8)}  ${Math.abs(diff) <= RETURN_TOLERANCE_POINTS ? 'ok' : 'wide'}`);
    }
    console.log(`   -> ${close} of ${compared} within ${RETURN_TOLERANCE_POINTS} points`);

    /**
     * A wide return is not necessarily wrong. Our bars are dividend-adjusted, so
     * they answer "what would I have made holding it", while the heatmap follows
     * the screen price. On a PSX name yielding double digits those are genuinely
     * different numbers, and the wider the gap the bigger the dividend.
     */
    if (wide.length) {
        console.log('\n   wider than tolerance:', wide.map(w => `${w.symbol} ${w.diff.toFixed(1)}`).join(', '));
        console.log('   Expected on a heavy dividend payer: our bars are adjusted, the heatmap');
        console.log('   is not. Check whether those names went ex-dividend in the last month');
        console.log('   before treating it as a fault.');
    }

    await mongoose.disconnect();
};

run().catch((error) => {
    console.error('Validation failed:', error.message);
    process.exit(1);
});
