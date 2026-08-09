/**
 * Seed the journal from the reviewed trade table.
 *
 * Replaces the user's journal entirely: every figure below is confirmed, so
 * partial merging would leave older estimates behind.
 *
 * Usage: node src/scripts/seedJournal.js <userEmail>
 */
import 'dotenv/config';
import mongoose from 'mongoose';
import User from '../models/User.js';
import JournalEntry from '../models/JournalEntry.js';

const d = (iso) => new Date(`${iso}T00:00:00.000Z`);

const TRADES = [
    {
        symbol: 'UPS', exchange: 'NYSE', direction: 'long', setupType: 'other',
        entryDate: d('2026-01-08'), entryPrice: 107.43, quantity: 4,
        exitDate: d('2026-06-01'), exitPrice: 109.155, exitConfirmed: true,
        stopPlaced: false, eventChecked: false,
        emotionalState: 'neutral', marketCondition: 'sideways', mistakes: [],
        tags: ['lot-1'],
        notes: 'Lot 1 of three. Clean entry and exit, no issues identified. Whether a resting stop was in place is not recorded — left unticked rather than assumed.'
    },
    {
        symbol: 'UPS', exchange: 'NYSE', direction: 'long', setupType: 'other',
        entryDate: d('2026-04-14'), entryPrice: 101.74, quantity: 5,
        exitDate: d('2026-06-08'), exitPrice: 108.31, exitConfirmed: true,
        stopPlaced: false, eventChecked: false,
        emotionalState: 'neutral', marketCondition: 'sideways', mistakes: [],
        tags: ['lot-2'],
        notes: 'Lot 2 of three. Cost basis is the average of two purchases, 4/14 and 5/8; the entry date shown is the first of them. Clean entry and exit.'
    },
    {
        symbol: 'UPS', exchange: 'NYSE', direction: 'long', setupType: 'other',
        entryDate: d('2026-06-24'), entryPrice: 106.095, quantity: 4,
        exitDate: d('2026-07-08'), exitPrice: 110.60, exitConfirmed: true,
        stopPlaced: false, eventChecked: false,
        emotionalState: 'neutral', marketCondition: 'sideways', mistakes: [],
        tags: ['lot-3'],
        notes: 'Lot 3 of three. Clean entry and exit, no issues identified.'
    },
    {
        symbol: 'SMCI', exchange: 'NASDAQ', direction: 'long', setupType: 'other',
        entryDate: d('2026-05-28'), entryPrice: 42.027, quantity: 3,
        exitDate: d('2026-06-02'), exitPrice: 50.16, exitConfirmed: true,
        stopPlaced: false, eventChecked: false,
        emotionalState: 'confident', marketCondition: 'bullish', mistakes: [],
        notes: 'Best percentage gain of the set, held five days. Clean entry and exit. No resting stop recorded — the result was right but the protection is unconfirmed.'
    },
    {
        // The reference trade: a loss that cost exactly what it was supposed to.
        symbol: 'DXCM', exchange: 'NASDAQ', direction: 'long', setupType: 'other',
        entryDate: d('2026-06-08'), entryPrice: 77.575, quantity: 5,
        exitDate: d('2026-06-15'), exitPrice: 73.71, exitConfirmed: true,
        plannedStop: 73.71, stopPlaced: true, eventChecked: true,
        emotionalState: 'disciplined', marketCondition: 'sideways', mistakes: [],
        notes: 'Correctly managed. A real stop order was resting at the broker and it filled exactly as planned — a well-run loss, not a mistake. The only trade in the set with a placed stop.',
        lesson: 'A placed stop turns an open-ended loss into a known, budgeted one.'
    },
    {
        symbol: 'INTC', exchange: 'NASDAQ', direction: 'long', setupType: 'other',
        entryDate: d('2026-06-24'), entryPrice: 131.68, quantity: 3,
        exitDate: d('2026-07-08'), exitPrice: 108.09, exitConfirmed: true,
        stopPlaced: false, eventChecked: false,
        emotionalState: 'fearful', marketCondition: 'volatile',
        mistakes: ['no_stop_placed', 'no_profit_protection'],
        notes: 'No stop placed at the broker. Was +6% unrealized on the 6/30 statement and gave the whole gain back and more — no rule to protect an open profit and no cap on the eventual loss. The single worst trade of the set.',
        lesson: 'An open gain needs a rule to protect it, not an opinion about it.'
    },
    {
        // Still open. The mark is hand-entered, not a live quote.
        symbol: 'MAS', exchange: 'NYSE', direction: 'long', setupType: 'other',
        entryDate: d('2026-07-16'), entryPrice: 79.47, quantity: 4,
        markPrice: 71.48,
        stopPlaced: false, eventChecked: false,
        emotionalState: 'neutral', marketCondition: 'volatile',
        mistakes: ['no_stop_placed', 'held_through_event'],
        tags: ['earnings'],
        notes: 'Still open. No stop placed at the broker, and held through a known, scheduled earnings date — the stock gapped down after the print with no chance to exit at any intended level. The mark of 71.48 is hand-entered, not a live quote.',
        lesson: 'Check the earnings calendar before entering, and place the stop before the print.'
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

    const removed = await JournalEntry.deleteMany({ user: user._id });
    await JournalEntry.insertMany(TRADES.map(t => ({ ...t, user: user._id })));

    console.log(`Journal replaced for ${email}: ${removed.deletedCount} removed, ${TRADES.length} inserted.`);
    await mongoose.disconnect();
}

main().catch(async (error) => {
    console.error(error.message);
    await mongoose.disconnect();
    process.exit(1);
});
