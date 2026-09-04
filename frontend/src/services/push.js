import api from './api';

/**
 * Web Push, from the browser's side.
 *
 * Three things have to line up before a device can receive an alert: the
 * browser supports the API, the user has granted permission, and the server has
 * a subscription row. This module owns all three, so the UI only has to ask
 * "can I?" and "is it on?".
 */

/** iOS only exposes the Push API to a web app launched from the Home Screen. */
export const isStandalone = () =>
    window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;

const isIOS = () => /iP(hone|ad|od)/.test(navigator.userAgent);

export const isSupported = () =>
    'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

/**
 * Why this device cannot be enabled, or null if it can.
 *
 * On iOS an un-installed tab reports no PushManager at all, which is
 * indistinguishable from an old browser unless the platform is checked - and
 * "add it to your Home Screen" is a thing the user can act on, where
 * "unsupported" is not.
 */
export function blockedReason() {
    if (isIOS() && !isStandalone()) {
        return 'On iPhone, add this app to your Home Screen first (Share → Add to Home Screen), then open it from there.';
    }
    if (!isSupported()) return 'This browser does not support push notifications.';
    if (Notification.permission === 'denied') {
        return 'Notifications are blocked for this site. Allow them in your browser settings, then try again.';
    }
    return null;
}

/** The server sends the key base64url; the browser wants bytes. */
function toUint8Array(base64url) {
    const padded = (base64url + '='.repeat((4 - base64url.length % 4) % 4))
        .replace(/-/g, '+').replace(/_/g, '/');
    const raw = atob(padded);
    return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

/**
 * The worker, registering it if it is not there yet.
 *
 * main.jsx skips registration in dev so it cannot interfere with hot reload.
 * Enabling push is an explicit click, so registering here is deliberate and
 * lets the whole path be tested locally instead of only after a deploy.
 */
async function worker() {
    return (await navigator.serviceWorker.getRegistration())
        || navigator.serviceWorker.register('/sw.js');
}

/** The subscription this browser is holding, if any. */
async function current() {
    if (!isSupported() || Notification.permission !== 'granted') return null;
    const reg = await navigator.serviceWorker.getRegistration();
    return (await reg?.pushManager.getSubscription()) || null;
}

/** Whether this browser holds a subscription. Says nothing about the server. */
export async function isEnabled() {
    return Boolean(await current());
}

/**
 * Reconcile this browser with the server, and report what is really listening.
 *
 * These two drift, and nothing noticed. The browser keeps a subscription the
 * server deleted on a 410, or Apple rotates the endpoint and the server is left
 * holding a dead one - either way the toggle reads on, levels keep firing, and
 * the phone stays quiet. `isEnabled` could never catch it: it only ever asked
 * the browser about the browser.
 *
 * So the subscription is re-sent on every launch. subscribe() upserts on the
 * endpoint, so this is idempotent and costs one request, and it repairs a
 * missing server row without anyone noticing it was gone. Then the server is
 * asked what it can reach, because that is the only answer worth showing.
 *
 * Failing is fine and silent: offline, or a token that has expired, is not
 * something to interrupt a launch over.
 *
 * @returns {Promise<{here: boolean, count: number} | null>} null if unknowable
 */
export async function sync() {
    try {
        const subscription = await current();
        if (subscription) {
            await api.post('/notifications/push/subscribe', { subscription: subscription.toJSON() });
        }
        const { data } = await api.get('/notifications/push/devices', {
            params: { endpoint: subscription?.endpoint }
        });
        return data.data;
    } catch {
        return null;
    }
}

/**
 * Turns push on for this device. Must be called from a click - browsers refuse
 * a permission prompt that no one asked for.
 */
export async function enable() {
    const blocked = blockedReason();
    if (blocked) throw new Error(blocked);

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') throw new Error('Permission was not granted.');

    const { data } = await api.get('/notifications/push/key');
    if (!data.data.configured) throw new Error('Push is not configured on the server.');

    const reg = await worker();
    await navigator.serviceWorker.ready;

    // An existing subscription is reused. Re-subscribing with a different key
    // throws, and re-subscribing with the same one just returns this.
    const subscription = await reg.pushManager.getSubscription()
        || await reg.pushManager.subscribe({
            // Non-negotiable on every browser that ships push: a silent push is
            // not allowed, every one must show something.
            userVisibleOnly: true,
            applicationServerKey: toUint8Array(data.data.publicKey)
        });

    await api.post('/notifications/push/subscribe', { subscription: subscription.toJSON() });
    return true;
}

/** Turns it off for this device only, and forgets the row server-side. */
export async function disable() {
    const reg = await navigator.serviceWorker.getRegistration();
    const subscription = await reg?.pushManager.getSubscription();
    if (!subscription) return false;

    await api.delete('/notifications/push/subscribe', { data: { endpoint: subscription.endpoint } });
    await subscription.unsubscribe();
    return true;
}

export async function sendTest() {
    const { data } = await api.post('/notifications/push/test');
    return data;
}

export default { isSupported, isStandalone, blockedReason, isEnabled, sync, enable, disable, sendTest };
