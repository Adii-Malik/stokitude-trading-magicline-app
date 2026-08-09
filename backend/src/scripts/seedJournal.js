/**
 * Seed the journal from the trading-journal handoff.
 *
 * Only what the handoff actually states is recorded. Anything it marks as
 * unconfirmed stays flagged (exitConfirmed / datesEstimated) so the stats can
 * discount it instead of treating recollection as fact.
 *
 * Usage: node src/scripts/seedJournal.js <userEmail>
 */
import 'dotenv/config';
import mongoose from 'mongoose';
import User from '../models/User.js';
import JournalEntry from '../models/JournalEntry.js';

// The 6/30 statement is the only date anchor the handoff gives for these trades.
const ANCHOR = new Date('2026-06-30');

const TRADES = [
    {
        symbol: 'MAS', exchange: 'NYSE', direction: 'long', setupType: 'other',
        entryDate: ANCHOR, entryPrice: 79.47, quantity: 4,
        exitPrice: 71.48, exitConfirmed: false, datesEstimated: true,
        stopPlaced: false, eventChecked: false,
        emotionalState: 'neutral', marketCondition: 'volatile',
        mistakes: ['no_stop_placed', 'held_through_event'],
        tags: ['earnings'],
        notes: 'Held through a scheduled earnings print with no stop resting at the broker. Gapped through — no fill was possible at any stop level. Exit price ~71.48 is unconfirmed; entry date needs a broker statement.',
        lesson: 'Check the earnings calendar before entering any multi-day swing.'
    },
    {
        symbol: 'INTC', exchange: 'NASDAQ', direction: 'long', setupType: 'other',
        entryDate: ANCHOR, entryPrice: 131.68, quantity: 3,
        exitPrice: 110, exitConfirmed: false, datesEstimated: true,
        stopPlaced: false, eventChecked: false,
        emotionalState: 'neutral', marketCondition: 'volatile',
        mistakes: ['no_stop_placed', 'no_profit_protection'],
        notes: 'Was +6% unrealized as of the 6/30 statement, then gave it all back. No trailing stop and no partial profit-take. Exit ~110 is recalled, not confirmed — an earlier recollection of "-25%" turned out to be wrong, which is why this stays flagged.',
        lesson: 'An open gain needs a rule to protect it, not just an opinion.'
    },
    {
        // The handoff is explicit: correctly managed. A loss, but not a mistake.
        symbol: 'DXCM', exchange: 'NASDAQ', direction: 'long', setupType: 'other',
        entryDate: ANCHOR, entryPrice: 77.575, quantity: 5,
        exitPrice: 73.71, exitConfirmed: true, datesEstimated: true,
        plannedStop: 73.71, stopPlaced: true, eventChecked: true,
        emotionalState: 'disciplined', marketCondition: 'sideways',
        mistakes: [],
        notes: 'Stop was placed at the broker and filled exactly as planned. Textbook -1R. Do not "fix" this trade — the process was right and the outcome was the cost of doing business.',
        lesson: 'A placed stop turns an open-ended loss into a known one.'
    },
    {
        symbol: 'SMCI', exchange: 'NASDAQ', direction: 'long', setupType: 'other',
        entryDate: ANCHOR, entryPrice: 42.027, quantity: 3,
        exitPrice: 50.16, exitConfirmed: true, datesEstimated: true,
        stopPlaced: false, eventChecked: false,
        emotionalState: 'neutral', marketCondition: 'bullish',
        mistakes: [],
        notes: 'Clean entry and exit, no issues flagged. Whether a stop was actually resting at the broker is not recorded in the handoff — stopPlaced/eventChecked are left false rather than assumed. Correct them if you know.',
        lesson: ''
    },
    {
        // Still open: 4 shares bought 6/24. No exit, so no P/L claimed.
        symbol: 'UPS', exchange: 'NYSE', direction: 'long', setupType: 'other',
        entryDate: new Date('2026-06-24'), entryPrice: 106.095, quantity: 4,
        stopPlaced: false, eventChecked: false,
        emotionalState: 'neutral', marketCondition: 'sideways',
        mistakes: [],
        notes: 'Open position. Separate from this: partial sells on 6/1 @ 109.155 and 6/8 @ 108.31 belong to older lots whose cost basis predates the April 2026 statement — those cannot be journaled until an earlier statement or the 1099 turns up.',
        lesson: ''
    }
];

async function main() {
    const email = process.argv[2];
    if (!email) {
        console.error('Usage: node src/scripts/seedJournal.js <userEmail>');
        process.exit(1);
    }

    await mongoose.connect(process.env.MONGO_URI);

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
        console.error(`No user found for ${email}`);
        await mongoose.disconnect();
        process.exit(1);
    }

    let created = 0;
    let skipped = 0;
    for (const trade of TRADES) {
        const exists = await JournalEntry.findOne({
            user: user._id, symbol: trade.symbol, entryPrice: trade.entryPrice
        });
        if (exists) {
            skipped++;
            continue;
        }
        await JournalEntry.create({ ...trade, user: user._id });
        created++;
    }

    console.log(`Journal seeded for ${email}: ${created} created, ${skipped} already present.`);
    await mongoose.disconnect();
}

main().catch(async (error) => {
    console.error(error.message);
    await mongoose.disconnect();
    process.exit(1);
});
