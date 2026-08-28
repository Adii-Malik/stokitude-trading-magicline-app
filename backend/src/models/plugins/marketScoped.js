import { marketStore } from '../../config/marketStore.js';
import { MARKET_CODES, marketOfCurrency, marketOfExchange } from '../../config/exchanges.js';

/**
 * Scopes a collection to the market the request is running in.
 *
 * Applied to the models that are ever *listed* without a portfolio id -
 * Portfolio, JournalEntry, Stock, StockFundamental, RiskProfile. Everything else
 * is reached through a portfolio that is already scoped, so filtering it again
 * would cost a predicate and buy nothing.
 *
 * The market is stamped on write from the venue and filtered on read. Neither is
 * something a caller has to remember, which is the point: a query is scoped
 * because it is a query, not because somebody thought of it.
 */

/** Where this model keeps the fact that decides its market. */
const DERIVE = {
    exchange: (doc) => (doc.exchange ? marketOfExchange(doc.exchange) : null),
    currency: (doc) => (doc.currency ? marketOfCurrency(doc.currency) : null)
};

/**
 * What to add to a query's filter, or null to leave it alone.
 *
 * Exported for its own tests: this is the whole safety argument in one function,
 * and it decides silently, so it is the part that has to be provable.
 */
export function scopeNow(store, options = {}) {
    // A way out that needs no rebuild. For a change that mutates every query,
    // being able to switch it off from the environment is worth four lines.
    if (process.env.MARKET_SCOPE === 'off') return null;

    // Said out loud at the call site: /auth/me needs every market to know which
    // ones you hold, and admin manages stocks across both.
    if (options.unscoped) return null;

    // No store at all is a job, a script or an event handler. Those run outside
    // any request and must see everything.
    if (!store) return null;

    // A store with no market is a request that lost its context. Returning both
    // markets here would be the exact failure this plugin exists to prevent, so
    // it fails loudly instead.
    if (!store.market) {
        throw new Error('Market scope lost inside a request. Refusing to query unscoped.');
    }

    return { market: store.market };
}

/**
 * @param from  Which field the market is derived from on write, or null when the
 *              model has no such field and its writer sets the market instead.
 *              RiskProfile is the only case: it carries nothing but a user and a
 *              portfolio id, and is written in exactly one place, which already
 *              loads the book it belongs to.
 */
export function marketScoped({ from = null }) {
    const derive = from === null ? null : DERIVE[from];
    if (from !== null && !derive) throw new Error(`marketScoped: unknown source '${from}'`);

    return function plugin(schema) {
        schema.add({
            market: { type: String, enum: MARKET_CODES, index: true }
        });

        // Stamped from the venue, never typed, so the column cannot drift from
        // the field it is derived from or be left off by a new code path.
        const stamp = (doc) => {
            if (derive && doc && !doc.market) {
                const market = derive(doc);
                if (market) doc.market = market;
            }
        };

        schema.pre('save', function () { stamp(this); });
        schema.pre('insertMany', function (next, docs) {
            (docs || []).forEach(stamp);
            next();
        });

        // Reads and writes alike. Scoping only reads would defend the view while
        // leaving updateMany free to cross the boundary underneath it.
        schema.pre(/^find|^count|^distinct|^update|^replace|^delete|^remove/, function () {
            const filter = scopeNow(marketStore.getStore(), this.getOptions());
            if (filter) this.where(filter);
        });

        // Aggregations do not run query middleware, so they need their own hook -
        // and the $match has to lead, or it filters after the work is done.
        schema.pre('aggregate', function () {
            const filter = scopeNow(marketStore.getStore(), this.options || {});
            if (filter) this.pipeline().unshift({ $match: filter });
        });

        /** `Model.find(...).unscoped()` - deliberate, and visible in the diff. */
        schema.query.unscoped = function () {
            return this.setOptions({ unscoped: true });
        };
    };
}

export default marketScoped;
