import { formatCurrency, formatPercent, getPnLColorClass } from '../../utils/portfolioUtils';
import { mistakeLabel } from './labels';

/**
 * The finding, not the dashboard. One line that says what is actually costing
 * money, above three numbers worth glancing at.
 */
export default function JournalHeadline({ stats }) {
    if (!stats?.byCurrency?.length) return null;

    // Lead with whichever account has the most closed trades behind it.
    const main = stats.byCurrency[0];
    const { headline } = main;
    const followed = stats.process?.followedPlanRate ?? 0;

    return (
        <div className="bg-surface rounded-card shadow-card ring-1 ring-hairline border border-gray-200 dark:border-gray-700 p-5">
            {headline && headline.cost < 0 ? (
                <p className="text-gray-900 dark:text-white">
                    <span className="font-semibold">{mistakeLabel(headline.mistake)}</span>
                    {' '}cost you{' '}
                    <span className="font-bold text-red-600 dark:text-red-400">
                        {formatCurrency(Math.abs(headline.cost), main.currency)}
                    </span>
                    {' '}across {headline.count} trade{headline.count > 1 ? 's' : ''}. Everything else made{' '}
                    <span className={`font-bold ${getPnLColorClass(headline.netWithout)}`}>
                        {formatCurrency(headline.netWithout, main.currency, { signed: true })}
                    </span>.
                </p>
            ) : (
                <p className="text-gray-600 dark:text-gray-400">
                    No repeated mistake yet. Keep logging — the pattern needs trades to show up.
                </p>
            )}

            <div className="flex flex-wrap gap-x-8 gap-y-2 mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                <Figure label={`Net (${main.currency})`}
                    value={formatCurrency(main.netPnL, main.currency, { signed: true })}
                    color={getPnLColorClass(main.netPnL)} />
                <Figure label="Win rate" value={formatPercent(main.winRate, 0)}
                    sub={`${main.wins}W / ${main.losses}L`} />
                <Figure label="Followed the plan" value={formatPercent(followed, 0)}
                    color={followed >= 80 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}
                    sub="stop placed and event checked" />
            </div>
        </div>
    );
}

function Figure({ label, value, sub, color }) {
    return (
        <div>
            <div className="text-xs text-gray-500 dark:text-gray-400">{label}</div>
            <div className={`text-2xl font-bold ${color || 'text-gray-900 dark:text-white'}`}>{value}</div>
            {sub && <div className="text-xs text-gray-500 dark:text-gray-400">{sub}</div>}
        </div>
    );
}
