/**
 * PSX tax date maths.
 *
 * Every one of these decides money. A month lost at a boundary moves a lot from
 * the 12.5% tier to 15%, and a day lost at the year end files a disposal against
 * the wrong tax year.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
    holdingMonths, cgtRateFor, taxYearOf, taxYearBounds, cgtByTaxYear, FILER_STATUS
} from './taxConfig.js';

describe('holding period', () => {
    test('counts whole calendar months', () => {
        assert.equal(holdingMonths('2025-01-15T00:00:00Z', '2025-07-15T00:00:00Z'), 6);
    });

    test('does not credit a month that has not completed', () => {
        assert.equal(holdingMonths('2024-06-15T00:00:00Z', '2025-06-14T00:00:00Z'), 11);
        assert.equal(holdingMonths('2024-06-15T00:00:00Z', '2025-06-15T00:00:00Z'), 12);
    });

    test('is read in UTC, not the server timezone', () => {
        // A fill booked at 20:00 UTC is already the next day in Asia/Karachi.
        // Read locally that cost a whole month, and with it a tier.
        assert.equal(holdingMonths('2025-03-15T20:00:00Z', '2025-09-15T00:00:00Z'), 6);
    });

    test('never goes negative, and survives rubbish', () => {
        assert.equal(holdingMonths('2025-07-15T00:00:00Z', '2025-01-15T00:00:00Z'), 0);
        assert.equal(holdingMonths('not a date', '2025-01-15T00:00:00Z'), 0);
    });
});

describe('CGT tiers', () => {
    const rate = (m, s) => cgtRateFor(m, s).rate;

    test('a filer pays 15, 12.5, then nothing', () => {
        assert.equal(rate(0), 15);
        assert.equal(rate(11), 15);
        assert.equal(rate(12), 12.5, 'twelve months exactly is the medium tier');
        assert.equal(rate(23), 12.5);
        assert.equal(rate(24), 0, 'beyond two years is exempt');
        assert.equal(rate(120), 0);
    });

    test('a non-filer pays 20 until the exemption, which is not filer-dependent', () => {
        const nf = FILER_STATUS.NON_FILER;
        assert.equal(rate(11, nf), 20);
        assert.equal(rate(12, nf), 20, 'no medium-tier discount for a non-filer');
        assert.equal(rate(24, nf), 0);
    });

    test('names the tier, so a report can show why the rate applied', () => {
        assert.equal(cgtRateFor(6).label, 'short-term');
        assert.equal(cgtRateFor(18).label, 'medium-term');
        assert.equal(cgtRateFor(36).label, 'long-term');
    });
});

describe('tax year', () => {
    test('runs July to June', () => {
        assert.equal(taxYearOf('2025-07-01T00:00:00Z'), 2026);
        assert.equal(taxYearOf('2026-06-30T00:00:00Z'), 2026);
        assert.equal(taxYearOf('2026-07-01T00:00:00Z'), 2027);
    });

    test('is read in UTC', () => {
        // 20:30 UTC on 30 June is 1 July in Karachi. Read locally, the last
        // disposal of the year was filed against the next one.
        assert.equal(taxYearOf('2026-06-30T20:30:00Z'), 2026);
    });

    test('bounds enclose their own year and nothing else', () => {
        const { start, end } = taxYearBounds(2026);
        assert.equal(taxYearOf(start), 2026);
        assert.equal(taxYearOf(end), 2026);
        assert.equal(taxYearOf(new Date(start.getTime() - 1)), 2025);
        assert.equal(taxYearOf(new Date(end.getTime() + 1)), 2027);
    });
});

describe('loss relief and carry-forward', () => {
    const d = (taxYear, gain, cgtRate = 15) => ({ taxYear, gain, cgtRate });
    const year = (rows, y) => rows.find(r => r.taxYear === y);

    test('losses in the year cancel gains in the year', () => {
        // The defect this exists to fix: taxing gross gains billed nearly ten
        // times what the book actually netted.
        const [r] = cgtByTaxYear([d(2026, 1000), d(2026, -400)]);
        assert.equal(r.taxable, 600);
        assert.equal(r.tax, 90, '15% of the net, not of the 1000 gross');
    });

    test('a net loss year owes nothing and carries the balance forward', () => {
        const rows = cgtByTaxYear([d(2026, 200), d(2026, -1200), d(2027, 500)]);
        assert.equal(year(rows, 2026).tax, 0);
        assert.equal(year(rows, 2026).carriedForward, 1000);
        assert.equal(year(rows, 2027).tax, 0, 'the carried loss covers the next year too');
        assert.equal(year(rows, 2027).carriedForward, 500);
    });

    test('relief goes to the most heavily taxed gains first', () => {
        // 1000 of relief against a 15% gain saves 150; against 12.5% only 125.
        const [r] = cgtByTaxYear([d(2026, 1000, 15), d(2026, 1000, 12.5), d(2026, -1000)]);
        assert.equal(r.tax, 125, 'the 15% gain was relieved, leaving the 12.5% one');
    });

    test('relief is never spent on an exempt gain', () => {
        // A long-term gain is taxed at 0, so covering it would waste the loss.
        const rows = cgtByTaxYear([d(2026, 5000, 0), d(2026, -1000), d(2027, 1000, 15)]);
        assert.equal(year(rows, 2026).tax, 0);
        assert.equal(year(rows, 2026).carriedForward, 1000, 'kept for a year it can help');
        assert.equal(year(rows, 2027).tax, 0);
    });

    test('a loss expires after six tax years', () => {
        const rows = cgtByTaxYear([d(2020, -1000), d(2026, 1000), d(2027, 1000)]);
        assert.equal(year(rows, 2026).tax, 0, '2026 is exactly six years on, still usable');
        assert.equal(year(rows, 2027).tax, 150, 'by 2027 the loss has lapsed');
    });

    test('older losses are spent before newer ones', () => {
        // Otherwise the oldest expires while a fresher loss sits unused behind it.
        const rows = cgtByTaxYear([d(2025, -500), d(2026, -500), d(2026, 500)]);
        assert.equal(year(rows, 2026).tax, 0);
        assert.equal(year(rows, 2026).carriedForward, 500);
        const rows2 = cgtByTaxYear([d(2025, -500), d(2026, -500), d(2026, 500), d(2031, 500)]);
        assert.equal(year(rows2, 2031).tax, 0, 'the 2026 loss survived to be used');
    });

    test('no disposals means no rows rather than a zero year', () => {
        assert.deepEqual(cgtByTaxYear([]), []);
        assert.deepEqual(cgtByTaxYear(), []);
    });
});
