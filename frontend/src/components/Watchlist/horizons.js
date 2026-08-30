/**
 * When a name is asking for you, and when it is only sitting there.
 *
 * This used to derive a deadline from the board you found the name on - two days
 * for one spotted on the daily, sixty for one spotted on the yearly - and shout
 * "overdue by 100 days" when it lapsed. That rule was wrong twice over. The
 * board you happened to be scanning says nothing about how fast the setup you
 * actually found moves; you can spot a name on the twelve-month board and be
 * waiting on a daily breakout. And worse, a lapsed deadline corresponds to
 * nothing that happened. No information arrived. The stock did not reach a price
 * you cared about. Open the row and you will read the same chart and reach the
 * same conclusion, because nothing changed - which is how an alert teaches you
 * to stop reading alerts.
 *
 * So there is no deadline here, and nothing to remember. Two things ask for you,
 * and both are facts rather than opinions:
 *
 *   a level you named printed  - you chose the number and price got there
 *   you never opened it        - an unfinished action, not a stale one
 *
 * Everything else is sorted by how long it has been and left alone. The ordering
 * does the nagging; the screen stops inventing urgency it cannot know about.
 */

const DAY = 24 * 60 * 60 * 1000;

/** Whole days between then and now, floored. */
export function daysSince(when, now = Date.now()) {
    if (!when) return 0;
    return Math.max(0, Math.floor((now - new Date(when).getTime()) / DAY));
}

/** The last time you put eyes on it, or the day you flagged it if you never have. */
export function lastLookAt(item) {
    if (!item) return null;
    if (item.lastLookAt) return item.lastLookAt;
    const looks = item.looks || [];
    return looks.length ? looks[looks.length - 1].at : item.noticedAt;
}

/** Only a name you are still watching is in the queue at all. */
export function isLive(item) {
    return item?.state === 'watching';
}

/**
 * Did a level you named actually print?
 *
 * True only while the firing is unanswered: the watcher disarms the trigger when
 * it fires, and setting a new one on your next look clears the flag by replacing
 * it. So this means "the thing you asked to be woken for happened and you have
 * not been back since".
 */
export function hasFired(item) {
    return Boolean(item?.triggeredAt) && !item?.trigger && isLive(item);
}

/**
 * Flagged, and never opened once.
 *
 * The one piece of neglect worth mentioning, because it is an unfinished action
 * rather than an ageing one - you told the system this was interesting and then
 * did not look. It clears the first time you do, whatever you conclude.
 *
 * A revived name counts as opened: putting it back is a decision you just made.
 */
export function neverOpened(item) {
    return isLive(item) && !item?.looks?.length && !item?.resumedAt;
}

/** Is this one asking for you? Only ever for a reason it can name. */
export function isDue(item) {
    return hasFired(item) || neverOpened(item);
}

/** Days since you last put eyes on it. The number the row states plainly. */
export function daysIdle(item, now = Date.now()) {
    return daysSince(lastLookAt(item), now);
}

/**
 * How many are asking for you. One number, and only for the two real reasons.
 *
 * A badge that is always lit in a shade you have to interpret says less than one
 * that appears when something has actually happened. Absent is a true statement:
 * nothing wants you.
 */
export function tally(items = []) {
    return { due: items.filter(isDue).length };
}

/**
 * The list, most in need of you first.
 *
 * Three tiers, and the first two are the only ones the screen has an opinion
 * about. A fired level outranks everything: you asked to be interrupted for that
 * number and you have not been back. A name you never opened comes next, because
 * it is an action you started and left. Everything after that is sorted by how
 * long it has been, which surfaces neglect without calling it a failure.
 *
 * The caller settles the order once on load - a queue that re-sorts while you
 * work it moves the row out from under your cursor.
 */
export function order(items = [], now = Date.now()) {
    const rank = (i) => (hasFired(i) ? 0 : neverOpened(i) ? 1 : 2);
    return items
        .filter(isLive)
        .map((i) => ({ item: i, rank: rank(i), idle: daysIdle(i, now) }))
        .sort((a, b) => (a.rank !== b.rank ? a.rank - b.rank : b.idle - a.idle))
        .map((x) => x.item);
}

/**
 * How a name stopped being live. Null while it still is.
 *
 * The distinction that matters is who decided: the watcher closed a dead idea
 * because price reached a number you named, where passing on one was your own
 * call. Both are finished, which is why they share a list.
 */
export function kindOf(item) {
    if (item?.state === 'invalidated') return 'dead';
    if (item?.state === 'dropped') return 'passed';
    if (item?.state === 'traded') return 'traded';
    return null;
}

/**
 * Two lists: the work, and what came of everything else.
 *
 * A closed idea gets no inbox of its own and nothing to acknowledge. The watcher
 * already pushed you a notification when it died - a second badge you clear by
 * hand is a chore invented to make itself go away. Sorting history by when each
 * name settled does the same job for free: one closed on Tuesday is at the top
 * on Wednesday and has sunk by the following week, without you touching it.
 */
export function split(items = [], now = Date.now()) {
    return {
        queue: order(items, now),
        past: items.filter(kindOf)
            .sort((a, b) => new Date(b.settledAt || 0) - new Date(a.settledAt || 0))
    };
}

/**
 * Does this row match what you typed?
 *
 * Symbol and sector, because those are the two things you remember about a name
 * you are hunting for. Notes are deliberately not searched: matching on text
 * inside a collapsed thread hides the reason the row appeared.
 */
export function matches(item, query) {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return `${item.symbol} ${item.name || ''} ${item.sector || ''}`.toLowerCase().includes(q);
}

/**
 * The pill, or nothing at all.
 *
 * Null for most rows, deliberately. A name that is merely sitting there has no
 * status worth a coloured chip - how long it has been is already in the line
 * below it, in words, which is enough.
 */
export function statusOf(item) {
    if (hasFired(item)) return { text: 'Your level printed', tone: 'fired' };
    if (neverOpened(item)) return { text: 'Never opened', tone: 'soon' };
    return null;
}

/**
 * Where price sits between the two levels, as 0..1, or null when there is
 * nothing to draw.
 *
 * Clamped, and it reports which end it is pinned to, because a name that has
 * run past its invalidation is the most informative case on the screen and
 * silently flattening it to 0 would hide exactly that.
 */
export function meterFor(item) {
    const lo = item?.invalidation?.price;
    const hi = item?.trigger?.price;
    const now = item?.priceNow;
    if (lo == null || hi == null || now == null || lo === hi) return null;

    const [min, max] = lo < hi ? [lo, hi] : [hi, lo];
    const at = (now - min) / (max - min);
    return {
        at: Math.max(0, Math.min(1, at)),
        past: at < 0 ? 'invalidation' : at > 1 ? 'trigger' : null,
        lo: { price: lo, label: item.invalidation.dir === 'below' ? 'dead below' : 'dead above' },
        hi: { price: hi, label: item.trigger.dir === 'above' ? 'wake me above' : 'wake me below' },
        now
    };
}

export default {
    daysSince, lastLookAt, daysIdle, isLive, hasFired, neverOpened, isDue,
    tally, order, kindOf, split, matches, statusOf, meterFor
};
