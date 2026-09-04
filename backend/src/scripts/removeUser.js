/**
 * Delete an account, by email, and everything scoped to it.
 *
 * There is no self-serve delete and no admin screen path for a user who signed
 * up and should not have - the flow is signup, then approval, and a rejected
 * signup just sits there inactive forever.
 *
 * Refuses to touch an account that owns anything. A user with portfolios,
 * journal entries or transactions is not a stray signup, and deleting one from
 * a command line would orphan its records with no way back. Those go through
 * the app.
 *
 *   node src/scripts/removeUser.js someone@example.com          # dry run
 *   node src/scripts/removeUser.js someone@example.com --delete
 */
import 'dotenv/config';
import { connectDB } from '../config/mongodb.js';
import config from '../config/config.js';
import User from '../models/User.js';
import Portfolio from '../models/Portfolio.js';
import JournalEntry from '../models/JournalEntry.js';
import Watchlist from '../models/Watchlist.js';
import NotificationPreference from '../models/NotificationPreference.js';
import Notification from '../models/Notification.js';
import PushSubscription from '../models/PushSubscription.js';

const email = process.argv[2];
const confirmed = process.argv.includes('--delete');

async function main() {
    if (!email) {
        console.error('Usage: node src/scripts/removeUser.js <email> [--delete]');
        process.exit(1);
    }

    await connectDB(config.mongoUri);

    // Unscoped: a script runs outside any request and must see both markets.
    const user = await User.findOne({ email }).select('_id username email isActive role');
    if (!user) {
        console.log(`No account for ${email}.`);
        return;
    }

    console.log(`${user.username} <${user.email}>  role=${user.role}  active=${user.isActive}`);

    const owned = {
        portfolios: await Portfolio.countDocuments({ owner: user._id }),
        journal: await JournalEntry.countDocuments({ user: user._id }),
        shortlist: await Watchlist.countDocuments({ user: user._id })
    };
    console.log(`  owns: ${owned.portfolios} portfolio(s), ${owned.journal} journal entr(ies), ${owned.shortlist} shortlist name(s)`);

    const total = owned.portfolios + owned.journal + owned.shortlist;
    if (total > 0) {
        console.log('\nRefusing: this account owns records. Delete them in the app first.');
        return;
    }

    // Only the rows that exist purely because the account did.
    const attached = {
        preferences: await NotificationPreference.countDocuments({ userId: user._id }),
        notifications: await Notification.countDocuments({ userId: user._id }),
        pushDevices: await PushSubscription.countDocuments({ userId: user._id })
    };
    console.log(`  attached: ${Object.entries(attached).map(([k, v]) => `${v} ${k}`).join(', ')}`);

    if (!confirmed) {
        console.log('\nDry run. Re-run with --delete to remove it.');
        return;
    }

    await Promise.all([
        NotificationPreference.deleteMany({ userId: user._id }),
        Notification.deleteMany({ userId: user._id }),
        PushSubscription.deleteMany({ userId: user._id })
    ]);
    await User.deleteOne({ _id: user._id });
    console.log(`\nDeleted ${user.email}.`);
}

main()
    .catch((error) => { console.error(error.message); process.exitCode = 1; })
    .finally(() => process.exit());
