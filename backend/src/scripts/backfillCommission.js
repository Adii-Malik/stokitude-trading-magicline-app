/**
 * Recalculate commission on existing BUY/SELL transactions from the
 * portfolio's slab, then rebuild positions.
 *
 * Setting a slab only affects new transactions - the form prefills from it.
 * Trades entered before the slab existed keep whatever fee was typed, which
 * for a per-share rate entered as a flat fee is short by a factor of the
 * share count.
 *
 * Statutory charges are never touched: only the broker note knows those.
 *
 *   node src/scripts/backfillCommission.js <userEmail>            # dry run
 *   node src/scripts/backfillCommission.js <userEmail> --write
 */
import 'dotenv/config';
import mongoose from 'mongoose';
import User from '../models/User.js';
import Portfolio from '../models/Portfolio.js';
import Transaction from '../models/Transaction.js';
import portfolioService from '../services/portfolioService.js';
import { commissionFor } from '../utils/commission.js';

const money = (n) => n.toFixed(2).padStart(10);

async function main() {
    const email = process.argv[2];
    const write = process.argv.includes('--write');
    if (!email) {
        console.error('Usage: node src/scripts/backfillCommission.js <userEmail> [--write]');
        process.exit(1);
    }

    await mongoose.connect(process.env.MONGO_URI);

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
        console.error(`No user found for ${email}`);
        await mongoose.disconnect();
        process.exit(1);
    }

    const portfolios = await Portfolio.find({ owner: user._id });
    let changed = 0;

    for (const portfolio of portfolios) {
        const slabs = portfolio.commissionSlabs || [];
        if (!slabs.length) {
            console.log(`\n${portfolio.name}: no commission slab set, skipping`);
            continue;
        }

        const txs = await Transaction.find({
            portfolioId: portfolio._id,
            type: { $in: ['BUY', 'SELL'] }
        }).sort({ executedAt: 1 });

        console.log(`\n${portfolio.name} — ${txs.length} trade(s)`);
        console.log('  date         qty     price        was      becomes');

        let before = 0;
        let after = 0;

        for (const tx of txs) {
            const expected = commissionFor({ price: tx.price, quantity: tx.quantity, slabs });
            const current = tx.fees || 0;
            before += current;
            after += expected;

            if (Math.abs(expected - current) < 0.005) continue;

            console.log(`  ${tx.executedAt.toISOString().slice(0, 10)} ${String(tx.quantity).padStart(6)} ${String(tx.price).padStart(7)} ${money(current)} ${money(expected)}`);

            if (write) {
                tx.fees = Number(expected.toFixed(2));
                await tx.save();
            }
            changed++;
        }

        console.log(`  commission total: ${before.toFixed(2)} -> ${after.toFixed(2)}`);

        if (write) {
            await portfolioService.rebuildPositions(portfolio._id, user._id);
            console.log('  positions rebuilt');
        }
    }

    console.log(write
        ? `\nUpdated ${changed} transaction(s).`
        : `\nDry run: ${changed} transaction(s) would change. Re-run with --write to apply.`);

    await mongoose.disconnect();
}

main().catch(async (error) => {
    console.error(error.message);
    await mongoose.disconnect();
    process.exit(1);
});
