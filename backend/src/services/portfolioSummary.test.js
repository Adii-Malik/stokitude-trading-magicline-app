/**
 * The base a book's return is measured against.
 *
 * Split out of the full cash walk so the list page can compute it without
 * carrying every buy and sell: on the real book that was 2,076 documents to
 * reach one number per portfolio.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { investedBase, cashFrom } from './portfolioService.js';

const dep = (n) => ({ type: 'DEPOSIT', cashAmount: n });
const wd = (n) => ({ type: 'WITHDRAW', cashAmount: n });

describe('what a book is measured against', () => {
    test('the peak is the high-water mark, not the closing balance', () => {
        // Put in 500, take out 400, put in 100: the account was once trusted
        // with 500, and a return measured against the remaining 200 flatters it.
        assert.deepEqual(investedBase([dep(500), wd(400), dep(100)]),
            { tracked: true, peakInvested: 500 });
    });

    test('untracked when nothing has moved in or out', () => {
        // A book reconstructed from fills alone has no deposit history, so the
        // caller falls back to cost basis rather than dividing by zero.
        assert.deepEqual(investedBase([]), { tracked: false, peakInvested: 0 });
    });

    test('buys and sells cancel out of it entirely', () => {
        // The reason only two types are fetched.
        const withTrades = [dep(500), { type: 'BUY', quantity: 4, price: 100 },
            { type: 'SELL', quantity: 4, price: 110 }, dep(100)];
        assert.deepEqual(investedBase(withTrades), investedBase([dep(500), dep(100)]));
    });

    test('agrees with the full cash walk it was split from', () => {
        const rows = [dep(500), wd(400), dep(100)];
        const full = cashFrom(rows);
        const light = investedBase(rows);
        assert.equal(light.peakInvested, full.peakInvested);
        assert.equal(light.tracked, full.tracked);
    });
});
