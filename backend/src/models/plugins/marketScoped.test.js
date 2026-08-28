/**
 * The safety argument for the market plugin.
 *
 * This decides silently on every query in the app, so the cases below are the
 * design rather than a check on it: what gets scoped, what deliberately does
 * not, and the one case that must fail loudly instead of guessing.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { scopeNow } from './marketScoped.js';

describe('what gets scoped', () => {
    test('a request carries its market into the filter', () => {
        assert.deepEqual(scopeNow({ market: 'PK' }), { market: 'PK' });
        assert.deepEqual(scopeNow({ market: 'US' }), { market: 'US' });
    });
});

describe('what deliberately does not', () => {
    // A job, a script, or an event handler fired by a price update. None of them
    // has a request, and all of them must see every market.
    test('no store at all means no scope', () => {
        assert.equal(scopeNow(undefined), null);
        assert.equal(scopeNow(null), null);
    });

    // /auth/me needs both markets to say which you hold; admin edits stocks
    // across both. Written at the call site, so it shows up in a diff.
    test('unscoped is honoured when asked for', () => {
        assert.equal(scopeNow({ market: 'PK' }, { unscoped: true }), null);
    });

    test('the kill switch turns everything off without a rebuild', () => {
        const before = process.env.MARKET_SCOPE;
        process.env.MARKET_SCOPE = 'off';
        try {
            assert.equal(scopeNow({ market: 'PK' }), null);
        } finally {
            if (before === undefined) delete process.env.MARKET_SCOPE;
            else process.env.MARKET_SCOPE = before;
        }
    });
});

describe('the case that must not be guessed', () => {
    /**
     * A store exists but carries no market: the request began and then lost its
     * context. Falling back to unscoped here would serve both markets from a
     * screen that promised one, and nothing would error - which is precisely the
     * bug the plugin exists to prevent.
     */
    test('a request that lost its market throws rather than returning both', () => {
        assert.throws(() => scopeNow({}), /Market scope lost/);
        assert.throws(() => scopeNow({ market: null }), /Market scope lost/);
        assert.throws(() => scopeNow({ market: '' }), /Market scope lost/);
    });

    test('but an explicit unscoped still wins over it', () => {
        assert.equal(scopeNow({}, { unscoped: true }), null);
    });
});
