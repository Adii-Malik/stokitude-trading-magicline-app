/** Where a market switch leaves you. */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { landingFor } from './market.js';

describe('landingFor', () => {
    // The bug: switching to US on /portfolios/<a PKR book> reloaded the same
    // URL, so the page came back showing rupees under a US flag.
    test('a book page falls back to the list', () => {
        assert.equal(landingFor('/portfolios/6a88c599ce0ce815d7d841f2'), '/portfolios');
    });

    test('so does a holding inside one', () => {
        assert.equal(landingFor('/portfolios/6a88c599ce0ce815d7d841f2/NCL'), '/portfolios');
    });

    test('the list itself is already fine', () => {
        assert.equal(landingFor('/portfolios'), '/portfolios');
    });

    // Everything else survives: the journal filters itself, and a profile or a
    // notification belongs to no market at all.
    test('pages that are not about one book stay put', () => {
        assert.equal(landingFor('/journal'), '/journal');
        assert.equal(landingFor('/dashboard'), '/dashboard');
        assert.equal(landingFor('/profile'), '/profile');
        assert.equal(landingFor('/'), '/');
    });
});

describe('a sector page after a market switch', () => {
    test('lands on the board, not on a sector the other market does not have', () => {
        assert.equal(landingFor('/heatmap/CEMENT'), '/heatmap');
        assert.equal(landingFor('/heatmap/OIL%20%26%20GAS'), '/heatmap');
    });

    test('the board itself survives', () => {
        assert.equal(landingFor('/heatmap'), '/heatmap');
    });
});
