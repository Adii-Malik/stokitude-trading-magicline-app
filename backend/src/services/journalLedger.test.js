/**
 * Journal ↔ ledger guards.
 *
 * These two rules are the ones that protect real money: a currency mismatch would
 * post dollars into a rupee ledger, and a loose edit check would let the journal
 * disagree with a portfolio that reconciles to a broker balance.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { assertLinkable, assertEditable } from './journalLedger.js';

const throws = (fn, code) => {
    try {
        fn();
        return null;
    } catch (error) {
        assert.equal(error.code, code, `expected ${code}, got ${error.code}: ${error.message}`);
        return error;
    }
};

describe('what may be booked where', () => {
    test('matching currencies are fine', () => {
        assert.equal(assertLinkable({ currency: 'PKR' }, { name: 'A', currency: 'PKR' }), undefined);
    });

    test('a USD trade cannot go into a PKR portfolio', () => {
        const err = throws(() => assertLinkable({ currency: 'USD' }, { name: 'Trading', currency: 'PKR' }),
            'CURRENCY_MISMATCH');
        assert.match(err.message, /USD trade/);
        assert.match(err.message, /Trading/, 'names the portfolio so the fix is obvious');
    });

    test('the reverse is refused too', () => {
        throws(() => assertLinkable({ currency: 'PKR' }, { name: 'US', currency: 'USD' }), 'CURRENCY_MISMATCH');
    });

    test('both default to PKR rather than being treated as unknown', () => {
        assert.equal(assertLinkable({}, { name: 'A' }), undefined);
    });

    test('a missing portfolio is its own error', () => {
        throws(() => assertLinkable({ currency: 'PKR' }, null), 'PORTFOLIO_NOT_FOUND');
    });
});

describe('what may be edited once booked', () => {
    const booked = {
        entryTransactionId: 'tx1',
        portfolioId: 'pf1',
        entryPrice: 900,
        quantity: 10,
        entryDate: new Date('2026-08-01T09:30:00Z')
    };

    test('an unbooked entry is fully editable', () => {
        assert.equal(assertEditable({ entryPrice: 900 }, { entryPrice: 950 }), undefined);
    });

    test('changing a booked entry price is refused', () => {
        const err = throws(() => assertEditable(booked, { entryPrice: 950 }), 'LEDGER_OWNED');
        assert.match(err.message, /entryPrice/);
    });

    test('changing a booked quantity is refused', () => {
        throws(() => assertEditable(booked, { quantity: 20 }), 'LEDGER_OWNED');
    });

    test('resending the same numbers is not a change', () => {
        // The form posts every field. Treating an unchanged resend as an edit would
        // make a booked trade impossible to save at all.
        assert.equal(assertEditable(booked, { entryPrice: 900, quantity: 10 }), undefined);
    });

    test('a date input resending the same day is not a change', () => {
        // '2026-08-01' against a stored Date carrying 09:30. Compared as strings
        // this looked like an edit and locked out every save.
        assert.equal(assertEditable(booked, { entryDate: '2026-08-01' }), undefined);
    });

    test('a genuinely different day is refused', () => {
        throws(() => assertEditable(booked, { entryDate: '2026-08-02' }), 'LEDGER_OWNED');
    });

    test('moving a booked trade to another portfolio is refused', () => {
        // Its transactions are already in the first one.
        const err = throws(() => assertEditable(booked, { portfolioId: 'pf2' }), 'LEDGER_OWNED');
        assert.match(err.message, /portfolio/);
    });

    test('review fields are never locked', () => {
        assert.equal(assertEditable(booked, {
            lesson: 'sized too big', notes: 'more', mistakes: ['oversized'],
            emotionalState: 'fomo', plannedStop: 880, targets: [{ price: 1100 }]
        }), undefined);
    });
});

describe('un-closing a booked trade', () => {
    const closed = { entryTransactionId: 'tx1', exitTransactionId: 'tx2', exitPrice: 950, exitDate: new Date('2026-08-10') };

    test('is refused, because the sell is a real ledger row', () => {
        const err = throws(() => assertEditable(closed, { exitPrice: null }), 'LEDGER_OWNED');
        assert.match(err.message, /cannot be cleared/);
        assert.match(err.message, /portfolio/, 'points at where the fix actually is');
    });

    test('changing the exit price is refused', () => {
        throws(() => assertEditable(closed, { exitPrice: 960 }), 'LEDGER_OWNED');
    });

    test('but clearing an unbooked exit still works', () => {
        // Journal-only trades keep the behaviour that let a mistaken exit be undone.
        assert.equal(assertEditable({ exitPrice: 950 }, { exitPrice: null }), undefined);
    });
});
