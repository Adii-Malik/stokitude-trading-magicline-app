/** CSV import tests: the export format must re-import unchanged. */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import csv from 'csv-parser';
import { Readable } from 'stream';
import { parseTransactionRow } from './portfolios.js';

// Parse text the way the route does, so header quirks are covered.
const rowsOf = async (text) => {
    const rows = [];
    await new Promise((resolve, reject) => {
        Readable.from(text).pipe(csv())
            .on('data', r => rows.push(r)).on('end', resolve).on('error', reject);
    });
    return rows.map(parseTransactionRow);
};

const ok = (row) => {
    const { transaction, error } = parseTransactionRow(row);
    assert.equal(error, undefined, `unexpected error: ${error}`);
    return transaction;
};

describe('export format', () => {
    test('a BUY row carries both charge columns', () => {
        const tx = ok({
            symbol: 'MEBL', exchange: 'PSX', type: 'BUY', quantity: '150',
            price: '212.54', fees: '22.5', otherCharges: '4',
            executedAt: '2025-01-01', notes: ''
        });
        assert.equal(tx.symbol, 'MEBL');
        assert.equal(tx.exchange, 'PSX');
        assert.equal(tx.quantity, 150);
        assert.equal(tx.price, 212.54);
        assert.equal(tx.fees, 22.5);
        assert.equal(tx.otherCharges, 4);
    });

    test('blank charge columns settle at zero rather than NaN', () => {
        const tx = ok({ symbol: 'DCR', type: 'SELL', quantity: '900', price: '21.63', fees: '', otherCharges: '', executedAt: '2025-04-09' });
        assert.equal(tx.fees, 0);
        assert.equal(tx.otherCharges, 0);
    });

    test('empty optional columns do not become fields', () => {
        const tx = ok({ symbol: 'SYS', type: 'BUY', quantity: '250', price: '105.54', fees: '37.5', otherCharges: '0', dividendCash: '', cashAmount: '', ratio: '', executedAt: '2026-03-11', notes: '' });
        assert.equal(tx.ratio, undefined);
        assert.equal(tx.dividendCash, undefined);
    });
});

describe('legacy headers', () => {
    test('capitalised Type/Date still import', () => {
        const tx = ok({ Symbol: 'fabl', Type: 'buy', Quantity: '350', Price: '47.04', Fees: '52.5', Date: '2025-01-01' });
        assert.equal(tx.symbol, 'FABL', 'symbol is upper-cased');
        assert.equal(tx.type, 'BUY');
        assert.equal(tx.executedAt.getFullYear(), 2025);
    });

    test('DIV accepts the old Amount column', () => {
        const tx = ok({ Symbol: 'EFERT', Type: 'DIV', Amount: '1200', Date: '2025-06-01' });
        assert.equal(tx.dividendCash, 1200);
        assert.equal(tx.dividendType, 'CASH');
    });
});

describe('cash and corporate actions', () => {
    test('DEPOSIT writes cashAmount, the field the model actually has', () => {
        const tx = ok({ type: 'DEPOSIT', cashAmount: '50000', executedAt: '2025-01-01' });
        assert.equal(tx.cashAmount, 50000);
        assert.equal(tx.amount, undefined, 'the old wrong field name is gone');
    });

    test('a SPLIT round trips its ratio', () => {
        const tx = ok({ symbol: 'OGDC', type: 'SPLIT', ratio: '2:1', executedAt: '2025-05-01' });
        assert.equal(tx.ratio, '2:1');
    });

    test('a SPLIT without a ratio is rejected, not silently dropped', () => {
        const { error } = parseTransactionRow({ symbol: 'OGDC', type: 'SPLIT', executedAt: '2025-05-01' });
        assert.match(error, /ratio is required/);
    });
});

describe('files as spreadsheets actually save them', () => {
    const header = 'symbol,exchange,type,quantity,price,fees,otherCharges,dividendCash,cashAmount,ratio,executedAt,notes';
    const line = 'MEBL,PSX,BUY,150,212.54,22.5,0,,,,2025-01-01,';

    test('a UTF-8 BOM does not blank out the first column', async () => {
        const [{ transaction, error }] = await rowsOf(`\uFEFF${header}\n${line}`);
        assert.equal(error, undefined);
        assert.equal(transaction.symbol, 'MEBL');
        assert.equal(transaction.type, 'BUY');
    });

    test('CRLF endings leave no carriage return on the last column', async () => {
        const [{ transaction, error }] = await rowsOf(`${header}\r\n${line}note\r\n`);
        assert.equal(error, undefined);
        assert.equal(transaction.notes, 'note');
    });
});

describe('rejected rows', () => {
    test('a missing date is an error', () => {
        const { error } = parseTransactionRow({ symbol: 'MEBL', type: 'BUY', quantity: '10', price: '200' });
        assert.match(error, /required/);
    });

    test('an unparseable date is named in the error', () => {
        const { error } = parseTransactionRow({ symbol: 'MEBL', type: 'BUY', quantity: '10', price: '200', executedAt: 'not-a-date' });
        assert.match(error, /Unrecognised date/);
    });

    test('an unknown type is rejected', () => {
        const { error } = parseTransactionRow({ symbol: 'MEBL', type: 'TRANSFER', executedAt: '2025-01-01' });
        assert.match(error, /Unknown type/);
    });

    test('a BUY without a price is rejected', () => {
        const { error } = parseTransactionRow({ symbol: 'MEBL', type: 'BUY', quantity: '150', executedAt: '2025-01-01' });
        assert.match(error, /quantity and price/);
    });

    test('thousands separators parse rather than truncating the value', () => {
        const tx = ok({ symbol: 'MEBL', type: 'BUY', quantity: '1,500', price: '212.54', executedAt: '2025-01-01' });
        assert.equal(tx.quantity, 1500);
    });
});
