import { AsyncLocalStorage } from 'node:async_hooks';

/**
 * The market a request is running in, carried without being passed.
 *
 * Every screen is scoped to one market. That rule used to be written out at each
 * call site - a filter in a route, a parameter threaded through a service - which
 * meant eight implementations of one idea and a ninth every time a screen was
 * added. The scope belongs under all of them, at the point where data is read.
 *
 * A store exists only inside a request. That is the whole signal: no store means
 * a job, a script or an event handler, and those must see every market. A store
 * with no market in it means a request that lost its context, which is a bug and
 * is treated as one rather than quietly returning both markets.
 */
export const marketStore = new AsyncLocalStorage();

/** The active market, or null outside a request. */
export function currentMarket() {
    return marketStore.getStore()?.market ?? null;
}

export default marketStore;
