import { FileText, Info } from 'lucide-react';
import { formatCurrency } from '../../utils/portfolioUtils';

/**
 * Capital gains by Pakistan tax year, which runs July to June.
 *
 * The figure on the summary card is one number; this is where it comes from, so
 * it can be checked against a filing rather than taken on trust. Gains and losses
 * are shown gross because that is what a return declares, with the relief between
 * them made explicit - the whole point being that tax falls on what was netted,
 * not on the profitable half of the book.
 */
export default function TaxYearReport({ dashboard, currency }) {
    const { cgtByYear = [], cgtMethod, filerStatus, taxRatePct = 15 } = dashboard || {};
    const money = (v, opts) => formatCurrency(v, currency, opts);

    if (cgtMethod !== 'HOLDING_PERIOD') {
        return (
            <Note>
                This portfolio uses <strong>{dashboard?.calculationMethod || 'average cost'}</strong>, which
                does not track lots — so capital gains tax is estimated at a flat {taxRatePct}% with no
                holding-period tiers, no long-term exemption and no loss relief. Switch it to
                <strong> NCCPL</strong> to get the real figure.
            </Note>
        );
    }

    if (cgtByYear.length === 0) {
        return <Note>No disposals yet, so there is nothing to report. Sell something and this fills in.</Note>;
    }

    const total = cgtByYear.reduce((s, y) => s + y.tax, 0);
    const carried = cgtByYear[cgtByYear.length - 1]?.carriedForward || 0;

    return (
        <div className="space-y-4">
            <header className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="flex items-center gap-2 font-semibold text-ink">
                    <FileText className="w-4 h-4 text-cyan-500" />
                    Capital gains by tax year
                </h3>
                <span className="text-xs text-ink-faint">
                    Pakistan tax year runs 1 July to 30 June · rates as a{' '}
                    {filerStatus === 'NON_FILER' ? 'non-filer' : 'filer'}
                </span>
            </header>

            <div className="overflow-x-auto">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="border-b border-hairline text-left text-ink-muted">
                            <th className="pb-2 font-medium">Tax year</th>
                            <th className="pb-2 font-medium text-right">Gains</th>
                            <th className="pb-2 font-medium text-right">Losses</th>
                            <th className="pb-2 font-medium text-right">Relief used</th>
                            <th className="pb-2 font-medium text-right">Taxable</th>
                            <th className="pb-2 font-medium text-right">Tax</th>
                            <th className="pb-2 font-medium text-right">Carried forward</th>
                        </tr>
                    </thead>
                    <tbody>
                        {cgtByYear.map((y) => (
                            <tr key={y.taxYear} className="border-b border-hairline/50">
                                <td className="py-2.5 text-ink whitespace-nowrap">
                                    {y.taxYear - 1}–{String(y.taxYear).slice(2)}
                                </td>
                                <td className="py-2.5 text-right tabular-nums text-green-600 dark:text-green-400">
                                    {money(y.gains)}
                                </td>
                                <td className="py-2.5 text-right tabular-nums text-red-600 dark:text-red-400">
                                    {y.losses ? money(y.losses) : '—'}
                                </td>
                                <td className="py-2.5 text-right tabular-nums text-ink-muted">
                                    {y.reliefUsed ? money(y.reliefUsed) : '—'}
                                </td>
                                <td className="py-2.5 text-right tabular-nums text-ink">{money(y.taxable)}</td>
                                <td className="py-2.5 text-right tabular-nums font-semibold text-amber-600 dark:text-amber-400">
                                    {money(y.tax)}
                                </td>
                                <td className="py-2.5 text-right tabular-nums text-ink-muted">
                                    {y.carriedForward ? money(y.carriedForward) : '—'}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                    <tfoot>
                        <tr className="border-t-2 border-hairline font-semibold text-ink">
                            <td className="pt-2.5">Total</td>
                            <td colSpan={4}></td>
                            <td className="pt-2.5 text-right tabular-nums text-amber-600 dark:text-amber-400">
                                {money(total)}
                            </td>
                            <td></td>
                        </tr>
                    </tfoot>
                </table>
            </div>

            {carried > 0 && (
                <Note>
                    <strong>{money(carried)}</strong> of unused capital losses carries forward. It can be set
                    against gains on listed securities for six tax years from the year it arose, but only if
                    the loss was declared in that year&apos;s return.
                </Note>
            )}

            <Note>
                Advance tax NCCPL would deduct at settlement, using the same holding-period tiers and FIFO
                matching. It is adjustable — you claim it as a credit when you file. Dividends are not here:
                they are recorded as cash received, already net of withholding, and that is a final tax.
            </Note>
        </div>
    );
}

function Note({ children }) {
    return (
        <p className="flex gap-2 text-xs text-ink-muted bg-surface-muted rounded-control p-3">
            <Info className="w-4 h-4 shrink-0 text-ink-faint mt-px" />
            <span>{children}</span>
        </p>
    );
}
