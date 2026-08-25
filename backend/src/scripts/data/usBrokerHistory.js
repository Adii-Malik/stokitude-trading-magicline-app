/**
 * The US brokerage account, as the broker reports it.
 *
 * Every fill, not one averaged row per trade. The journal holds a trade the way
 * it was thought about - four UPS buys on one morning are one decision - while
 * the ledger holds what actually happened, and those are different shapes. The
 * PSX book already works this way: 2,041 individual rows against a handful of
 * journal entries.
 *
 * Cancelled orders are left out. An order that never filled moved no cash and
 * bought no shares; it is a thing you can see in a broker's activity feed and
 * nowhere in a ledger.
 *
 * The Masco dividend of 1.28 on 26 Aug 2026 is omitted while it is pending.
 * Cash that has not settled is not cash, and counting it would put the balance
 * a dollar ahead of the account it is meant to reconcile to.
 */
export const EXCHANGE_OF = {
    UPS: 'NYSE', MAS: 'NYSE',
    INTC: 'NASDAQ', SMCI: 'NASDAQ', DXCM: 'NASDAQ'
};

/** [date, type, symbol, quantity, price] or [date, 'DEPOSIT'|'DIV', symbol, cash] */
export const US_HISTORY = [
    ['2025-04-22', 'DEPOSIT', null, 5.64, 'Bonus stock'],
    ['2025-04-23', 'DEPOSIT', null, 1.00, 'Deposit from PREMIER PLUS CKG'],
    ['2025-05-22', 'DEPOSIT', null, 500.00, 'Deposit from PREMIER PLUS CKG'],

    ['2026-01-08', 'BUY', 'UPS', 1, 107.40],
    ['2026-01-08', 'BUY', 'UPS', 1, 107.50],
    ['2026-01-08', 'BUY', 'UPS', 1, 107.42],
    ['2026-01-08', 'BUY', 'UPS', 1, 107.40],

    ['2026-03-06', 'DIV', 'UPS', 4.59, 'Dividend from UPS'],

    ['2026-04-15', 'BUY', 'UPS', 1, 102.41],
    ['2026-04-15', 'BUY', 'UPS', 2, 102.40],
    ['2026-04-20', 'DEPOSIT', null, 500.00, 'Deposit from PREMIER PLUS CKG'],
    ['2026-05-08', 'BUY', 'UPS', 1, 100.78],
    ['2026-05-08', 'BUY', 'UPS', 1, 100.70],

    ['2026-05-14', 'DEPOSIT', null, 500.00, 'Deposit from PREMIER PLUS CKG'],
    ['2026-05-21', 'DIV', 'UPS', 10.33, 'Early dividend from UPS'],

    ['2026-05-28', 'BUY', 'SMCI', 1, 42.10],
    ['2026-05-28', 'BUY', 'SMCI', 2, 41.99],

    ['2026-06-01', 'SELL', 'UPS', 4, 109.155],
    ['2026-06-03', 'SELL', 'SMCI', 3, 50.16],
    ['2026-06-08', 'SELL', 'UPS', 5, 108.306],

    ['2026-06-09', 'BUY', 'DXCM', 5, 77.576],
    ['2026-06-16', 'SELL', 'DXCM', 5, 73.71],

    ['2026-06-24', 'BUY', 'UPS', 1, 106.00],
    ['2026-06-24', 'BUY', 'UPS', 1, 106.08],
    ['2026-06-24', 'BUY', 'UPS', 2, 106.15],
    ['2026-06-24', 'BUY', 'INTC', 1, 131.70],
    ['2026-06-24', 'BUY', 'INTC', 1, 131.63],
    ['2026-06-24', 'BUY', 'INTC', 1, 131.71],

    ['2026-07-08', 'SELL', 'UPS', 4, 110.60],
    ['2026-07-08', 'SELL', 'INTC', 3, 108.09],

    ['2026-07-16', 'BUY', 'MAS', 4, 79.47]
];

/**
 * The journal's view of the same account: one entry per decision, priced at the
 * average of its fills. Dates are the broker's, which is why four of these
 * needed correcting - the seeded set had them a day early.
 */
export const US_JOURNAL = [
    { symbol: 'UPS', qty: 4, in: '2026-01-08', entry: 107.43, out: '2026-06-01', exit: 109.155 },
    { symbol: 'UPS', qty: 5, in: '2026-04-15', entry: 101.738, out: '2026-06-08', exit: 108.306 },
    { symbol: 'SMCI', qty: 3, in: '2026-05-28', entry: 42.027, out: '2026-06-03', exit: 50.16 },
    { symbol: 'DXCM', qty: 5, in: '2026-06-09', entry: 77.576, out: '2026-06-16', exit: 73.71 },
    { symbol: 'UPS', qty: 4, in: '2026-06-24', entry: 106.095, out: '2026-07-08', exit: 110.60 },
    { symbol: 'INTC', qty: 3, in: '2026-06-24', entry: 131.68, out: '2026-07-08', exit: 108.09 },
    { symbol: 'MAS', qty: 4, in: '2026-07-16', entry: 79.47, out: null, exit: null }
];
