import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Calendar } from 'lucide-react';
import api from '../../services/api';
import toast from 'react-hot-toast';
import { formatCurrency, formatPercent, formatShares, getPnLColorClass } from '../../utils/portfolioUtils';

/**
 * One symbol, end to end: what is still held, what the closed part returned,
 * and every transaction behind both. The fee line is the point - a name traded
 * a dozen times can look profitable right up until the brokerage is counted.
 */
export default function SymbolDetail() {
    const { id, symbol } = useParams();
    const navigate = useNavigate();
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        api.get(`/portfolios/${id}/symbols/${symbol}`)
            .then(res => setData(res.data.data))
            .catch(err => toast.error(err.response?.data?.message || 'Failed to load'))
            .finally(() => setLoading(false));
    }, [id, symbol]);

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-500"></div>
            </div>
        );
    }

    if (!data) {
        return (
            <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
                <p className="text-gray-600 dark:text-gray-400">No transactions for {symbol}</p>
            </div>
        );
    }

    const { position, result, counts, currency, transactions } = data;
    const open = position.quantity > 0;

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
            <div className="container mx-auto px-4 py-8 space-y-6">
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => navigate(`/portfolios/${id}`)}
                        className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                    >
                        <ArrowLeft className="w-5 h-5 text-gray-900 dark:text-white" />
                    </button>
                    <div className="min-w-0">
                        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{data.symbol}</h1>
                        <p className="text-sm text-gray-600 dark:text-gray-400 truncate">
                            {data.companyName}
                            {data.currentPrice > 0 && <> · {formatCurrency(data.currentPrice, currency)}</>}
                        </p>
                    </div>
                </div>

                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm grid lg:grid-cols-3
                                divide-y lg:divide-y-0 lg:divide-x divide-gray-200 dark:divide-gray-700">
                    <Section title={open ? 'Still held' : 'Position closed'}
                        value={open ? formatCurrency(position.marketValue, currency) : '—'}>
                        {open ? (
                            <>
                                <Line label="Shares" value={formatShares(position.quantity)} />
                                <Line label="Average cost" value={formatCurrency(position.avgCost, currency)} />
                                <Line label="Cost basis" value={formatCurrency(position.costBasis, currency)} />
                                <Line
                                    label="Unrealised"
                                    value={`${formatCurrency(position.unrealizedPnL, currency, { signed: true })} · ${formatPercent(position.unrealizedPnLPct, 1, { signed: true })}`}
                                    tone={getPnLColorClass(position.unrealizedPnL)}
                                    strong
                                />
                            </>
                        ) : (
                            <Line label="Shares" value="0 — nothing left in it" muted />
                        )}
                    </Section>

                    <Section
                        title="What it returned"
                        value={formatCurrency(result.net, currency, { signed: true })}
                        tone={getPnLColorClass(result.net)}
                    >
                        <Line label="Realised from sales" value={formatCurrency(result.realized, currency, { signed: true })} />
                        <Line label="Dividends" value={formatCurrency(result.dividends, currency)} />
                        <Line label="Commission and charges" value={formatCurrency(result.fees, currency)}
                            note="already inside realised" tone="text-amber-600 dark:text-amber-400" />
                    </Section>

                    <Section title="Activity" value={`${transactions.length} transactions`}>
                        <Line label="Buys" value={counts.buys} />
                        <Line label="Sells" value={counts.sells} />
                        <Line label="Dividends" value={counts.dividends} />
                        {position.firstPurchaseDate && (
                            <Line label="First bought"
                                value={new Date(position.firstPurchaseDate).toLocaleDateString()} muted />
                        )}
                    </Section>
                </div>

                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 sm:p-6">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                        Every transaction
                    </h2>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-gray-200 dark:border-gray-700 text-left text-gray-600 dark:text-gray-400">
                                    <th className="pb-2 font-medium">Date</th>
                                    <th className="pb-2 font-medium">Type</th>
                                    <th className="pb-2 font-medium text-right">Shares</th>
                                    <th className="pb-2 font-medium text-right">Price</th>
                                    <th className="pb-2 font-medium text-right">Charges</th>
                                    <th className="pb-2 font-medium text-right">Amount</th>
                                </tr>
                            </thead>
                            <tbody>
                                {transactions.map(tx => <TxRow key={tx._id} tx={tx} currency={currency} />)}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}

const TONES = {
    BUY: 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    SELL: 'bg-orange-50 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
    DIV: 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400'
};

function TxRow({ tx, currency }) {
    const charges = (tx.fees || 0) + (tx.otherCharges || 0);
    const gross = (tx.quantity || 0) * (tx.price || 0);
    // A purchase costs the charges on top; a sale nets them out of proceeds.
    const amount = tx.type === 'BUY' ? gross + charges
        : tx.type === 'SELL' ? gross - charges
            : tx.dividendCash || 0;

    return (
        <tr className="border-b border-gray-100 dark:border-gray-700/50">
            <td className="py-2.5 text-gray-900 dark:text-white whitespace-nowrap">
                <span className="inline-flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                    {new Date(tx.executedAt).toLocaleDateString()}
                </span>
            </td>
            <td className="py-2.5">
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${TONES[tx.type] || 'bg-gray-100 text-gray-700'}`}>
                    {tx.type}
                </span>
            </td>
            <td className="py-2.5 text-right text-gray-900 dark:text-white tabular-nums">
                {tx.quantity ? formatShares(tx.quantity) : '—'}
            </td>
            <td className="py-2.5 text-right text-gray-900 dark:text-white tabular-nums">
                {tx.price ? formatCurrency(tx.price, currency) : '—'}
            </td>
            <td className="py-2.5 text-right tabular-nums text-amber-600 dark:text-amber-400">
                {charges > 0 ? formatCurrency(charges, currency) : '—'}
            </td>
            <td className="py-2.5 text-right font-medium text-gray-900 dark:text-white tabular-nums">
                {formatCurrency(amount, currency)}
            </td>
        </tr>
    );
}

function Section({ title, value, tone = 'text-gray-900 dark:text-white', children }) {
    return (
        <div className="px-5 py-4">
            <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">{title}</div>
            <div className={`text-2xl font-bold mt-0.5 ${tone}`}>{value}</div>
            <div className="mt-3 space-y-1.5">{children}</div>
        </div>
    );
}

function Line({ label, value, note, tone, muted, strong }) {
    return (
        <div className={`flex items-baseline justify-between gap-3 text-sm
                        ${strong ? 'pt-1.5 border-t border-gray-200 dark:border-gray-700' : ''}`}>
            <span className={muted ? 'text-gray-400 dark:text-gray-500' : 'text-gray-600 dark:text-gray-400'}>
                {label}
                {note && <span className="block text-xs text-gray-400 dark:text-gray-500">{note}</span>}
            </span>
            <span className={`shrink-0 tabular-nums ${strong ? 'font-semibold' : ''} ${tone || (muted ? 'text-gray-400 dark:text-gray-500' : 'text-gray-900 dark:text-white')}`}>
                {value}
            </span>
        </div>
    );
}
