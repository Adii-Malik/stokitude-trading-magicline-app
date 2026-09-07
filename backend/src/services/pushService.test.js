/**
 * How hard, and for how long, the push service is asked to try.
 *
 * A level printed at 04:45 local and the phone never rang, while the app held
 * the notification with push.sent = true - because "sent" meant Apple took it,
 * not that anything was shown. Both knobs that decide whether it arrives were
 * wrong, and neither is visible from anywhere a person looks.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { URGENCY, TTL_SECONDS } from './pushService.js';

describe('push urgency', () => {
    test('a stop and a printed level both wake the phone', () => {
        // These are the two that exist to interrupt you. `high` used to fall
        // through to normal, where the push service may hold it back.
        assert.equal(URGENCY.urgent, 'high');
        assert.equal(URGENCY.high, 'high');
    });

    test('an idea closing itself does not', () => {
        assert.equal(URGENCY.medium, 'normal');
        assert.equal(URGENCY.low, 'low');
    });

    test('every priority the model allows has an urgency', () => {
        // The enum on Notification. A priority with no entry here silently
        // becomes normal, which is how `high` was lost in the first place.
        for (const p of ['low', 'medium', 'high', 'urgent']) {
            assert.ok(URGENCY[p], `no urgency for priority "${p}"`);
        }
    });
});

describe('push lifetime', () => {
    test('outlives a night on a nightstand', () => {
        // One hour expired before a sleeping phone asked for it. A price that
        // printed yesterday still printed.
        assert.ok(TTL_SECONDS >= 12 * 60 * 60, 'a push must survive longer than a sleep cycle');
        assert.equal(TTL_SECONDS, 86400);
    });
});
