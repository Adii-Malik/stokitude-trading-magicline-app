import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs/promises';
import path from 'path';
import { accepts, extensionFor, removeChart, CHART_DIR, URL_PREFIX, MAX_BYTES } from './chartStorage.js';

describe('what counts as a chart', () => {
    test('images in, anything else out', () => {
        for (const ok of ['image/png', 'image/jpeg', 'image/webp']) assert.ok(accepts(ok), ok);
        for (const no of ['text/html', 'application/pdf', 'image/svg+xml', 'application/javascript']) {
            assert.equal(accepts(no), false, `${no} must not be storable`);
        }
    });

    test('svg is refused even though it is an image', () => {
        // It can carry script, and these are served back to a browser.
        assert.equal(accepts('image/svg+xml'), false);
        assert.equal(extensionFor('image/svg+xml'), null);
    });

    test('a chart is capped at 6MB', () => {
        assert.equal(MAX_BYTES, 6 * 1024 * 1024);
    });
});

describe('deleting the file behind an entry', () => {
    test('removes a real chart and reports it', async () => {
        await fs.mkdir(CHART_DIR, { recursive: true });
        const name = 'test-chart-delete.png';
        await fs.writeFile(path.join(CHART_DIR, name), 'x');
        assert.equal(await removeChart(`${URL_PREFIX}${name}`), true);
        await assert.rejects(fs.access(path.join(CHART_DIR, name)));
    });

    test('a path from a document cannot reach outside the chart directory', async () => {
        // The value arrives from a stored field, so it is not to be trusted with
        // a filesystem call just because it came from our own database.
        for (const hostile of [
            `${URL_PREFIX}../../../../etc/passwd`,
            '/etc/passwd',
            '/uploads/other/thing.png',
            '../../secret.png'
        ]) {
            assert.equal(await removeChart(hostile), false, hostile);
        }
    });

    test('nothing to delete is not an error', async () => {
        assert.equal(await removeChart(undefined), false);
        assert.equal(await removeChart(''), false);
        assert.equal(await removeChart(`${URL_PREFIX}never-existed.png`), false);
    });
});
