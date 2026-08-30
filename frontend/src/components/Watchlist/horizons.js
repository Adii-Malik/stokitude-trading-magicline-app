/**
 * How long a flag stays interesting, decided by the board it came from.
 *
 * The instinct is a list per timeframe - one for daily, one for monthly - but a
 * named list has to be chosen while capturing, and a choice at capture time is
 * what stops you capturing. The period is already recorded from the board you
 * were on, so the grouping is free and cannot be mis-filed.
 *
 * Grouping is not only tidiness: it is what makes the numbers comparable. A
 * name down 3% since you noticed it is noise on a five-year idea and a serious
 * problem on one flagged yesterday. In a single flat column the two invite
 * exactly the wrong comparison.
 *
 * Staleness is derived here and nowhere else, and never configured. A flag is
 * not due because it is old, it is due because it is old *for its horizon*.
 *
 * And the clock runs from the last time you looked, not from the day you
 * flagged it. A name you checked yesterday is not overdue however long it has
 * been on the list - that was the flaw in measuring from noticedAt, which made
 * a name you were actively watching nag you every week.
 */

export const BANDS = [
    {
        id: 'short',
        name: 'Short',
        periods: ['change', 'Perf.W'],
        // A move spotted on the daily board is over by the time you get back to
        // it on Thursday.
        staleDays: 2
    },
    {
        id: 'swing',
        name: 'Swing',
        periods: ['Perf.1M', 'Perf.3M'],
        // Where most flags land. Long enough to think, short enough that the
        // setup still exists when you do.
        staleDays: 14
    },
    {
        id: 'theme',
        name: 'Theme',
        periods: ['Perf.6M', 'Perf.YTD', 'Perf.Y', 'Perf.5Y'],
        // A rotation, not a trade. Nagging weekly about one would teach you to
        // ignore the badge, which costs more than the reminder is worth.
        staleDays: 60
    }
];

/** The band a period belongs to. Unknown periods sit with the swings. */
export function bandFor(period) {
    return BANDS.find((b) => b.periods.includes(period)) || BANDS[1];
}

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

/**
 * Days until this one wants looking at again. Negative means overdue.
 *
 * This is the number the screen shows, in words, so you never have to hold the
 * rule in your head or work out a date difference at a glance.
 */
export function daysLeft(item, now = Date.now()) {
    if (!item) return 0;
    return bandFor(item.period).staleDays - daysSince(lastLookAt(item), now);
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
 * not been back since", which is a different and much louder thing than a
 * horizon quietly running out.
 */
export function hasFired(item) {
    return Boolean(item?.triggeredAt) && !item?.trigger && isLive(item);
}

/**
 * Is this one asking for you?
 *
 * Only live names are. A dead or dropped or traded name has an answer already,
 * and one of those nagging you is the fastest way to teach you to stop reading
 * the badge.
 *
 * Everything else is due once its horizon has run out since the last look -
 * which for a name you have never looked at is the day you flagged it, so a
 * fresh flag is due almost immediately on a short horizon and can wait a month
 * on a long one. A fired level is due whatever the clock says: you asked to be
 * told, and you have not been back.
 */
export function isDue(item, now = Date.now()) {
    if (!isLive(item)) return false;
    return hasFired(item) || daysLeft(item, now) < 0;
}

/**
 * How many are asking for you. One number, deliberately.
 *
 * A second "badly overdue" tier looked useful and was not: on a two-day horizon
 * you are a full window past after three days, so almost everything late
 * qualified and the distinction stopped distinguishing. Due is already the
 * alert - it means a deadline you set has passed - and a badge that appears
 * only when something wants you says more than one that is always lit in a
 * shade you have to interpret.
 */
export function tally(items = [], now = Date.now()) {
    return { due: items.filter((i) => isDue(i, now)).length };
}

/**
 * The list, most in need of you first.
 *
 * One flat order rather than sections. The horizon still decides everything -
 * it sets each name's deadline - but as a property of the row instead of a
 * heading above it: nine headings for seven rows was most of what made the
 * first version unreadable.
 *
 * Sorted by how overdue a name is, so the top of the screen is always the next
 * thing to do. The caller settles the order once on load, because a queue that
 * re-sorts while you work it moves the row out from under your cursor.
 */
export function order(items = [], now = Date.now()) {
    return items
        .filter(isLive)
        // A fired level outranks any timer. The clock running out is the screen
        // guessing you have forgotten; a level printing is the thing you
        // explicitly asked to be interrupted for, and burying it under a name
        // that is merely late would waste the one alert you set yourself.
        .map((i) => ({ item: i, fired: hasFired(i), left: daysLeft(i, now) }))
        .sort((a, b) => (a.fired !== b.fired ? (a.fired ? -1 : 1) : a.left - b.left))
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

/** The deadline as a sentence. The rule applied, not printed. */
export function dueText(item, now = Date.now()) {
    // A fired level replaces the countdown rather than sitting beside it. "Your
    // level printed" next to "13 days left" reads as a contradiction, and the
    // countdown is the half that stopped mattering the moment price got there.
    if (hasFired(item)) return { text: 'your level printed', tone: 'fired' };
    const left = daysLeft(item, now);
    if (left < 0) return { text: `overdue by ${-left} ${-left === 1 ? 'day' : 'days'}`, tone: 'late' };
    if (left === 0) return { text: 'due today', tone: 'late' };
    if (left <= 3) return { text: `${left} ${left === 1 ? 'day' : 'days'} left`, tone: 'soon' };
    return { text: `${left} days left`, tone: 'calm' };
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
    BANDS, bandFor, daysSince, lastLookAt, daysLeft, isLive, hasFired, isDue,
    tally, order, kindOf, split, matches, dueText, meterFor
};
