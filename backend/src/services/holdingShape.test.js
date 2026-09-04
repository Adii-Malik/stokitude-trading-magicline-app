/**
 * Absent is not zero.
 *
 * A US book had no price feed at all - Stock.currentPrice is stamped from PSX
 * daily bars and nothing else - so every US holding priced at zero, and zero is
 * arithmetically indistinguishable from having sold the position. The book
 * reported itself as all cash while it held four names, and showed each of them
 * down its entire cost. These are the assertions that stop that returning.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { shapeHolding } from './portfolioService.js';

const position = {
    symbol: 'EQT',
    netShares: 20,
    avgCost: 50,
    costBasis: 1000,
    realizedPnL: 0,
    dividendsReceived: 0,
    firstPurchaseDate: null
};

describe('a holding the feed could not price', () => {
    test('says so, rather than valuing it at nothing', () => {
        const h = shapeHolding(position, null, undefined);
        assert.equal(h.priced, false);
        assert.equal(h.currentPrice, null);
        assert.equal(h.totalValue, null);
    });

    test('reports no gain rather than a total loss', () => {
        const h = shapeHolding(position, null, undefined);
        assert.equal(h.unrealizedPnL, null);
        assert.equal(h.unrealizedPnLPct, null);
        assert.equal(h.totalPnL, null);
    });

    test('still knows what it cost and how many shares', () => {
        // The parts that never depended on a price stay answerable.
        const h = shapeHolding(position, null, undefined);
        assert.equal(h.quantity, 20);
        assert.equal(h.costBasis, 1000);
    });
});

describe('a holding the feed could price', () => {
    test('marks to the last price', () => {
        const h = shapeHolding(position, { companyName: 'EQT Corp' }, 55.61);
        assert.equal(h.priced, true);
        assert.equal(h.companyName, 'EQT Corp');
        assert.equal(h.totalValue, 1112.2);
        assert.ok(Math.abs(h.unrealizedPnL - 112.2) < 1e-9);
        assert.ok(Math.abs(h.unrealizedPnLPct - 11.22) < 1e-9);
    });

    test('a price of zero is a price, and is not treated as missing', () => {
        // Nothing on either board trades at zero, but the distinction is the
        // whole point: absent means unknown, not worthless.
        const h = shapeHolding(position, null, 0);
        assert.equal(h.priced, true);
        assert.equal(h.totalValue, 0);
        assert.equal(h.unrealizedPnL, -1000);
    });

    test('booked money counts, unrealised gain rides on top', () => {
        const withHistory = { ...position, realizedPnL: 300, dividendsReceived: 50 };
        const h = shapeHolding(withHistory, null, 55.61);
        assert.ok(Math.abs(h.totalPnL - (112.2 + 350)) < 1e-9);
    });
});
