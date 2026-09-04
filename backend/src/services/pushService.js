import webpush from 'web-push';
import PushSubscription from '../models/PushSubscription.js';

/**
 * Web Push delivery.
 *
 * The alert that matters here is a stop being reached while the app is shut. So
 * this runs from the price poll, outside any request, and talks to whatever
 * push service each browser was minted against - Apple's for an iPhone on the
 * Home Screen, Google's for Chrome. Both take the same VAPID keys, which is the
 * whole reason this needs no developer account and no Firebase project.
 */

const subject = process.env.VAPID_SUBJECT || 'mailto:admin@financialreading.dedyn.io';
const publicKey = process.env.VAPID_PUBLIC_KEY || '';
const privateKey = process.env.VAPID_PRIVATE_KEY || '';

export const isConfigured = Boolean(publicKey && privateKey);
if (isConfigured) webpush.setVapidDetails(subject, publicKey, privateKey);

/** The half the browser is allowed to see. */
export function vapidPublicKey() {
    return publicKey;
}

/**
 * What a subscription that will never work again looks like.
 *
 * 404 and 410 mean the browser threw the subscription away - uninstalled, or
 * iOS expiring one that had not been opened in weeks. The row is dead and
 * keeping it means retrying it on every alert forever, so it is deleted.
 * Anything else - a timeout, a 500 from the push service - is transient and the
 * row is left alone.
 */
const isGone = (status) => status === 404 || status === 410;

/**
 * Sends one notification to every device a user has registered.
 *
 * @returns {{ sent: number, gone: number, failed: number }}
 */
export async function sendToUser(userId, payload) {
    if (!isConfigured) return { sent: 0, gone: 0, failed: 0 };

    const subs = await PushSubscription.find({ userId, platform: 'web' });
    if (!subs.length) return { sent: 0, gone: 0, failed: 0 };

    const body = JSON.stringify(payload);
    const results = await Promise.all(subs.map(async (sub) => {
        try {
            await webpush.sendNotification(
                { endpoint: sub.endpoint, keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth } },
                body,
                // A stop that arrives an hour late is noise. If the phone has
                // been off longer than this, drop it rather than deliver it.
                { TTL: 3600, urgency: payload.priority === 'urgent' ? 'high' : 'normal' }
            );
            await PushSubscription.updateOne({ _id: sub._id }, { lastSeenAt: new Date() });
            return 'sent';
        } catch (error) {
            if (isGone(error.statusCode)) {
                await PushSubscription.deleteOne({ _id: sub._id });
                return 'gone';
            }
            console.error(`Push failed (${error.statusCode || 'no status'}): ${error.message}`);
            return 'failed';
        }
    }));

    return {
        sent: results.filter(r => r === 'sent').length,
        gone: results.filter(r => r === 'gone').length,
        failed: results.filter(r => r === 'failed').length
    };
}

/** Registers a device, or refreshes the one already on this endpoint. */
export async function subscribe(userId, subscription, userAgent) {
    const { endpoint, keys } = subscription;
    if (!endpoint || !keys?.p256dh || !keys?.auth) {
        throw Object.assign(new Error('Incomplete push subscription'), { status: 400 });
    }

    // Upsert on the endpoint, not on the user: the same person on a phone and a
    // laptop is two rows, and the same browser re-subscribing is one.
    return PushSubscription.findOneAndUpdate(
        { endpoint },
        { userId, platform: 'web', endpoint, keys, userAgent, lastSeenAt: new Date() },
        { upsert: true, new: true, setDefaultsOnInsert: true }
    );
}

/**
 * What the server believes it can reach, for one account.
 *
 * The browser's own view - permission granted, a subscription object present -
 * was the only thing the screen ever checked, and the two can disagree. A row
 * deleted on a 410, a database restored, an endpoint Apple rotated: the browser
 * still holds a subscription, the server has nothing, and the toggle reads on
 * while every alert goes nowhere. Only the server can answer "is anything
 * actually listening", so it is asked.
 *
 * `here` says whether this particular browser is one of them, because a laptop
 * still registered is no comfort when the phone in your hand is not.
 */
export async function devicesFor(userId, endpoint) {
    const subs = await PushSubscription.find({ userId, platform: 'web' })
        .select('endpoint lastSeenAt').lean();
    return {
        count: subs.length,
        here: Boolean(endpoint && subs.some(s => s.endpoint === endpoint)),
        lastSeenAt: subs.reduce((latest, s) =>
            (!latest || (s.lastSeenAt && s.lastSeenAt > latest) ? s.lastSeenAt : latest), null)
    };
}

export async function unsubscribe(userId, endpoint) {
    const { deletedCount } = await PushSubscription.deleteOne({ userId, endpoint });
    return deletedCount > 0;
}

export default { isConfigured, vapidPublicKey, sendToUser, subscribe, devicesFor, unsubscribe };
