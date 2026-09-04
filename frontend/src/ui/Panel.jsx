/**
 * The card the portfolio and symbol pages are built from: an icon, a headline
 * figure, and the rows that make it up. Raised and separated rather than
 * divided by hairlines, so a group reads as one object at a glance.
 */
export function Panel({ icon: Icon, tint = 'cyan', title, value, note, tone, children }) {
    const t = TINTS[tint] || TINTS.cyan;

    return (
        <div className="bg-surface rounded-card p-5 shadow-card hover:shadow-card-hover
                        transition-shadow ring-1 ring-hairline">
            <div className="flex items-center gap-2.5">
                {Icon && (
                    <span className={`grid place-items-center w-9 h-9 rounded-xl ${t.bg}`}>
                        <Icon className={`w-4 h-4 ${t.fg}`} />
                    </span>
                )}
                <span className="text-sm font-medium text-ink-muted">{title}</span>
            </div>

            <div className={`mt-3 text-2xl font-bold tracking-tight ${tone || 'text-ink'}`}>
                {value}
            </div>
            {note && <div className="text-xs text-ink-muted mt-0.5">{note}</div>}

            {children && (
                <div className="mt-4 pt-3 border-t border-hairline space-y-2">
                    {children}
                </div>
            )}
        </div>
    );
}

export function Line({ label, value, note, tone, muted, strong, onClick }) {
    // A line that opens something is a button, so it can be reached by keyboard
    // and reads as clickable rather than only behaving that way.
    const Label = onClick ? 'button' : 'span';

    return (
        <div className={`flex items-baseline justify-between gap-3 text-sm
                        ${strong ? 'pt-2 border-t border-hairline' : ''}`}>
            <Label
                {...(onClick ? { type: 'button', onClick } : {})}
                className={`text-left ${muted ? 'text-ink-faint' : 'text-ink-muted'}
                            ${onClick ? 'underline decoration-dotted underline-offset-4 hover:text-ink' : ''}`}>
                {label}
                {note && <span className="block text-xs text-ink-faint">{note}</span>}
            </Label>
            <span className={`shrink-0 tabular-nums ${strong ? 'font-semibold' : ''}
                             ${tone || (muted ? 'text-ink-faint' : 'text-ink')}`}>
                {value}
            </span>
        </div>
    );
}

const TINTS = {
    cyan: { bg: 'bg-cyan-50 dark:bg-cyan-500/10', fg: 'text-cyan-600 dark:text-cyan-400' },
    blue: { bg: 'bg-blue-50 dark:bg-blue-500/10', fg: 'text-blue-600 dark:text-blue-400' },
    green: { bg: 'bg-green-50 dark:bg-green-500/10', fg: 'text-green-600 dark:text-green-400' },
    amber: { bg: 'bg-amber-50 dark:bg-amber-500/10', fg: 'text-amber-600 dark:text-amber-400' },
    purple: { bg: 'bg-purple-50 dark:bg-purple-500/10', fg: 'text-purple-600 dark:text-purple-400' },
    gray: { bg: 'bg-gray-100 dark:bg-gray-700', fg: 'text-gray-600 dark:text-gray-300' }
};
