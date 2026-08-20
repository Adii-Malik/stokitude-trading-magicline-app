/**
 * Invariants that must hold for any book, not just the cases someone thought of.
 *
 * Tax code branches hard - three tiers, two filer statuses, same-day matching,
 * loss relief across years - and hand-written cases only cover the paths already
 * imagined. These run thousands of randomly generated books through the real
 * calculators and assert the things that can never be true, which is how the
 * unimagined path gets found.
 *
 * The generator is seeded, so a failure reproduces exactly.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import FIFOCalculator from './FIFOCalculator.js';
import NCCPLCalculator from './NCCPLCalculator.js';
import { cgtByTaxYear, CGT_TIERS } from '../../../config/taxConfig.js';

const fifo = new FIFOCalculator();
const nccpl = new NCCPLCalculator();

/** Deterministic PRNG (mulberry32), so any failure is reproducible. */
function rng(seed) {
    return () => {
        seed = (seed + 0x6D2B79F5) | 0;
        let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

const DAY = 86400000;
const START = Date.UTC(2022, 0, 3);

/**
 * A random but legal book: never sells more than it holds, so oversold handling
 * is not what is under test here.
 */
function randomBook(rand, { length = 30, allowSameDay = true } = {}) {
    const txs = [];
    let held = 0;
    let day = 0;

    for (let i = 0; i < length; i++) {
        // Same-day activity is the interesting case, so make it common.
        if (!allowSameDay || rand() > 0.35) day += 1 + Math.floor(rand() * 400);
        const executedAt = new Date(START + day * DAY);
        const price = Math.round((5 + rand() * 500) * 100) / 100;
        const fees = Math.round(rand() * 50 * 100) / 100;

        if (held === 0 || rand() < 0.55) {
            const quantity = 1 + Math.floor(rand() * 500);
            held += quantity;
            txs.push({ type: 'BUY', quantity, price, fees, executedAt });
        } else {
            const quantity = 1 + Math.floor(rand() * held);
            held -= quantity;
            txs.push({ type: 'SELL', quantity, price, fees, executedAt });
        }
    }
    return txs;
}

const near = (a, b, tol = 0.02) => Math.abs(a - b) <= tol;
const MAX_RATE = Math.max(...CGT_TIERS.flatMap(t => [t.filerRate, t.nonFilerRate]));

describe('settlement invariants over random books', () => {
    for (const [name, calc] of [['FIFO', fifo], ['NCCPL', nccpl]]) {
        test(`${name}: every share bought is either held or disposed of`, () => {
            for (let seed = 1; seed <= 300; seed++) {
                const book = randomBook(rng(seed));
                const r = calc.calculate(book, 100);

                const bought = book.filter(t => t.type === 'BUY').reduce((s, t) => s + t.quantity, 0);
                const sold = book.filter(t => t.type === 'SELL').reduce((s, t) => s + t.quantity, 0);
                const disposed = r.disposals.reduce((s, d) => s + d.quantity, 0);

                assert.ok(near(disposed, sold), `seed ${seed}: disposed ${disposed} vs sold ${sold}`);
                assert.ok(near(r.netShares, bought - sold), `seed ${seed}: held ${r.netShares} vs ${bought - sold}`);
            }
        });

        test(`${name}: realised P/L is the sum of its own disposals`, () => {
            for (let seed = 1; seed <= 300; seed++) {
                const r = calc.calculate(randomBook(rng(seed)), 100);
                const summed = r.disposals.reduce((s, d) => s + d.gain, 0);
                assert.ok(near(r.realizedPnL, summed, 0.5), `seed ${seed}: ${r.realizedPnL} vs ${summed}`);
            }
        });

        test(`${name}: no disposal is taxed at more than its own rate`, () => {
            for (let seed = 1; seed <= 300; seed++) {
                const r = calc.calculate(randomBook(rng(seed)), 100);
                for (const d of r.disposals) {
                    assert.ok(d.cgtTax >= 0, `seed ${seed}: negative tax`);
                    if (d.gain <= 0) assert.equal(d.cgtTax, 0, `seed ${seed}: a loss was taxed`);
                    assert.ok(d.cgtTax <= (Math.max(0, d.gain) * MAX_RATE) / 100 + 0.01,
                        `seed ${seed}: tax above the top rate`);
                }
            }
        });

        test(`${name}: a holding period is never negative, and its tier matches it`, () => {
            for (let seed = 1; seed <= 300; seed++) {
                const r = calc.calculate(randomBook(rng(seed)), 100);
                for (const d of r.disposals) {
                    assert.ok(d.holdingMonths >= 0, `seed ${seed}`);
                    const expected = d.holdingMonths < 12 ? 'short-term'
                        : d.holdingMonths < 24 ? 'medium-term' : 'long-term';
                    assert.equal(d.tier, expected, `seed ${seed}: ${d.holdingMonths}m read as ${d.tier}`);
                    if (d.tier === 'long-term') assert.equal(d.cgtTax, 0, `seed ${seed}: long-term taxed`);
                }
            }
        });
    }

    for (const [name, calc] of [['FIFO', fifo], ['NCCPL', nccpl]]) {
        test(`${name}: how a lot is sliced does not change what it cost`, () => {
            // Selling 100 as two 50s must report the same as selling 100 at once.
            // It did not: the lot's fees were charged in full to every slice,
            // because the divisor shrank while the fees stayed whole.
            for (let seed = 1; seed <= 200; seed++) {
                const rand = rng(seed);
                const qty = 20 + Math.floor(rand() * 200);
                const buy = {
                    type: 'BUY', quantity: qty, price: Math.round(rand() * 400) + 5,
                    fees: Math.round(rand() * 60 * 100) / 100, executedAt: new Date(START)
                };
                const price = Math.round(rand() * 400) + 5;
                const sell = (quantity, day) =>
                    ({ type: 'SELL', quantity, price, fees: 0, executedAt: new Date(START + day * DAY) });

                const atOnce = calc.calculate([buy, sell(qty, 40)], price);
                const half = Math.floor(qty / 2);
                const sliced = calc.calculate([buy, sell(half, 40), sell(qty - half, 41)], price);

                assert.ok(near(atOnce.realizedPnL, sliced.realizedPnL, 0.05),
                    `seed ${seed}: ${atOnce.realizedPnL} at once vs ${sliced.realizedPnL} sliced`);
            }
        });

        test(`${name}: a partly sold lot keeps only the fees it has not used`, () => {
            for (let seed = 1; seed <= 200; seed++) {
                const r = calc.calculate(randomBook(rng(seed)), 100);
                for (const lot of r.lots) {
                    assert.ok(lot.fees >= -0.01, `seed ${seed}: a lot owes negative fees`);
                    assert.ok(lot.quantity > 0, `seed ${seed}: an empty lot was kept`);
                }
            }
        });
    }

    test('NCCPL and FIFO agree exactly when nothing is traded same-day', () => {
        // The two rules only diverge on same-day activity. Anywhere else, a
        // difference would mean the override leaked into ordinary matching.
        for (let seed = 1; seed <= 200; seed++) {
            const book = randomBook(rng(seed), { allowSameDay: false });
            const a = fifo.calculate(book, 100);
            const b = nccpl.calculate(book, 100);

            assert.ok(near(a.realizedPnL, b.realizedPnL), `seed ${seed}: P/L differs`);
            assert.ok(near(a.cgtTax, b.cgtTax), `seed ${seed}: tax differs`);
            assert.ok(near(a.netShares, b.netShares), `seed ${seed}: holdings differ`);
        }
    });

    test('NCCPL leaves the same number of shares as FIFO, only different ones', () => {
        // Matching changes which lots are consumed, never how many shares exist.
        for (let seed = 1; seed <= 300; seed++) {
            const book = randomBook(rng(seed));
            assert.ok(near(fifo.calculate(book, 100).netShares, nccpl.calculate(book, 100).netShares),
                `seed ${seed}`);
        }
    });
});

describe('loss relief invariants over random disposals', () => {
    const randomDisposals = (rand, n = 40) => Array.from({ length: n }, () => ({
        taxYear: 2022 + Math.floor(rand() * 8),
        gain: Math.round((rand() * 20000 - 9000) * 100) / 100,
        cgtRate: [0, 12.5, 15, 20][Math.floor(rand() * 4)]
    }));

    test('tax is never negative and never exceeds the top rate on what is taxable', () => {
        for (let seed = 1; seed <= 400; seed++) {
            for (const row of cgtByTaxYear(randomDisposals(rng(seed)))) {
                assert.ok(row.tax >= 0, `seed ${seed}: negative tax`);
                assert.ok(row.tax <= (row.taxable * MAX_RATE) / 100 + 0.01,
                    `seed ${seed}: ${row.tax} on ${row.taxable} taxable`);
            }
        }
    });

    test('relief never invents losses that were not there', () => {
        for (let seed = 1; seed <= 400; seed++) {
            const disposals = randomDisposals(rng(seed));
            const rows = cgtByTaxYear(disposals);
            const totalLosses = -disposals.filter(d => d.gain < 0).reduce((s, d) => s + d.gain, 0);
            const totalRelief = rows.reduce((s, r) => s + r.reliefUsed, 0);

            assert.ok(totalRelief <= totalLosses + 0.01,
                `seed ${seed}: relieved ${totalRelief} against ${totalLosses} of losses`);
        }
    });

    test('taxable never exceeds the gains it came from, and is never negative', () => {
        for (let seed = 1; seed <= 400; seed++) {
            for (const row of cgtByTaxYear(randomDisposals(rng(seed)))) {
                assert.ok(row.taxable >= -0.01, `seed ${seed}: negative taxable`);
                assert.ok(row.taxable <= row.gains + 0.01, `seed ${seed}: taxable above gains`);
                assert.ok(row.carriedForward >= 0, `seed ${seed}: negative carry-forward`);
            }
        }
    });

    test('relieving losses can only ever reduce the bill', () => {
        // The whole point. Compared against taxing every gain on its own.
        for (let seed = 1; seed <= 400; seed++) {
            const disposals = randomDisposals(rng(seed));
            const gross = disposals
                .filter(d => d.gain > 0)
                .reduce((s, d) => s + (d.gain * d.cgtRate) / 100, 0);
            const relieved = cgtByTaxYear(disposals).reduce((s, r) => s + r.tax, 0);

            assert.ok(relieved <= gross + 0.01, `seed ${seed}: relief increased the tax`);
        }
    });
});
