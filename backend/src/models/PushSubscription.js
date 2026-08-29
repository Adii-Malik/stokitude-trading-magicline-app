import mongoose from 'mongoose';

/**
 * One browser, on one device, that has agreed to receive alerts.
 *
 * Deliberately not market-scoped. A phone is a phone: you want the stop on a
 * PSX trade and the target on a US one to reach the same lock screen, and the
 * price poll that raises them runs outside any request anyway.
 *
 * The endpoint is the identity. It is a URL the push service minted for this
 * browser, it is already unique, and re-subscribing the same device returns the
 * same one - so an upsert on it is what keeps a device from piling up rows.
 */
const pushSubscriptionSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },

    /**
     * Which pipe this row is delivered down. Only 'web' exists today; the field
     * is here so the native shell can add 'apns'/'fcm' rows beside these ones
     * without a migration, and so the sender can branch instead of assuming.
     */
    platform: {
        type: String,
        enum: ['web', 'apns', 'fcm'],
        default: 'web',
        index: true
    },

    endpoint: { type: String, required: true, unique: true },

    // The browser's half of the encryption. Push payloads are encrypted to these
    // and the push service cannot read them.
    keys: {
        p256dh: { type: String, required: true },
        auth: { type: String, required: true }
    },

    // Only to tell one device from another in the settings list.
    userAgent: { type: String },

    // Bumped on every successful send, so a device that has gone quiet is
    // visible as a date rather than a guess.
    lastSeenAt: { type: Date, default: Date.now }
}, { timestamps: true });

export default mongoose.model('PushSubscription', pushSubscriptionSchema);
