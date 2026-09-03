import { useState, useEffect } from 'react';
import { Search, ArrowUpDown, TrendingUp, TrendingDown, ChevronDown, ChevronRight } from 'lucide-react';
import api from '../../services/api';
import toast from 'react-hot-toast';
import { formatCurrency, formatPercent, formatShares, getPnLColorClass } from '../../utils/portfolioUtils';

export default function HoldingsTable({ portfolioId, currency, onSelectSymbol, refreshKey = 0 }) {
    const [holdings, setHoldings] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [sortField, setSortField] = useState('totalValue');
    const [sortDirection, setSortDirection] = useState('desc');

    // refreshKey changes when the parent books a transaction, so a change made
    // on another tab lands here without needing the remount a tab switch causes.
    useEffect(() => {
        loadHoldings();
    }, [portfolioId, refreshKey]);

    const loadHoldings = async () => {
        try {
            const response = await api.get(`/portfolios/${portfolioId}/holdings?includeClosed=true`);
            setHoldings(response.data.data);
        } catch (error) {
            toast.error('Failed to load holdings');
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const handleSort = (field) => {
        if (sortField === field) {
            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortDirection('desc');
        }
    };

    const matches = (h) =>
        h.symbol.toLowerCase().includes(searchTerm.toLowerCase()) ||
        h.companyName?.toLowerCase().includes(searchTerm.toLowerCase());

    // A closed position has no shares, price, value or weight - every column
    // here reads zero for it. Its one real number is what it realised, so it
    // belongs in its own list rather than padding this one out.
    const filteredAndSorted = holdings
        .filter(h => !h.closed && matches(h))
        .sort((a, b) => {
            const multiplier = sortDirection === 'asc' ? 1 : -1;
            return (a[sortField] - b[sortField]) * multiplier;
        });

    const totals = filteredAndSorted.reduce((t, h) => ({
        value: t.value + h.totalValue,
        cost: t.cost + h.costBasis,
        unrealized: t.unrealized + h.unrealizedPnL
    }), { value: 0, cost: 0, unrealized: 0 });

    const closed = holdings
        .filter(h => h.closed && matches(h))
        .sort((a, b) => b.realizedPnL - a.realizedPnL);

    if (loading) {
        return (
            <div className="flex justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-500"></div>
            </div>
        );
    }

    if (holdings.length === 0) {
        return (
            <div className="text-center py-12">
                <p className="text-ink-muted">No holdings yet. Add your first transaction to get started.</p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Search */}
            <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-ink-faint w-5 h-5" />
                <input
                    type="text"
                    placeholder="Search by symbol or company name..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                />
            </div>

            {/* Phones get cards; eight columns of numbers do not survive a 390px screen. */}
            <div className="md:hidden space-y-3">
                {filteredAndSorted.map((holding) => (
                    <HoldingCard key={holding.symbol} holding={holding} currency={currency} onSelectSymbol={onSelectSymbol} />
                ))}
            </div>

            {/* Table */}
            <div className="hidden md:block overflow-x-auto">
                <table className="w-full">
                    <thead>
                        <tr className="border-b border-hairline text-left">
                            <th className="pb-3 font-semibold text-gray-700 dark:text-gray-300">Symbol</th>
                            <SortableHeader
                                label="Shares"
                                field="quantity"
                                currentField={sortField}
                                direction={sortDirection}
                                onSort={handleSort}
                            />
                            <SortableHeader
                                label="Avg Cost"
                                field="avgCost"
                                currentField={sortField}
                                direction={sortDirection}
                                onSort={handleSort}
                            />
                            <SortableHeader
                                label="Current Price"
                                field="currentPrice"
                                currentField={sortField}
                                direction={sortDirection}
                                onSort={handleSort}
                            />
                            <SortableHeader
                                label="Total Value"
                                field="totalValue"
                                currentField={sortField}
                                direction={sortDirection}
                                onSort={handleSort}
                            />
                            <SortableHeader
                                label="Unrealized P/L"
                                field="unrealizedPnL"
                                currentField={sortField}
                                direction={sortDirection}
                                onSort={handleSort}
                            />
                            <SortableHeader
                                label="P/L %"
                                field="unrealizedPnLPct"
                                currentField={sortField}
                                direction={sortDirection}
                                onSort={handleSort}
                            />
                            <SortableHeader
                                label="Weight"
                                field="weightPct"
                                currentField={sortField}
                                direction={sortDirection}
                                onSort={handleSort}
                            />
                        </tr>
                    </thead>
                    <tbody>
                        {filteredAndSorted.map((holding) => (
                            <HoldingRow key={holding.symbol} holding={holding} currency={currency} onSelectSymbol={onSelectSymbol} />
                        ))}
                    </tbody>
                    <tfoot>
                        {/* The row that sums the table should read as the loudest
                            one, not the faintest - it carried no colour at all
                            and inherited its way to near-invisible in dark. */}
                        <tr className="border-t-2 border-hairline font-bold text-ink">
                            <td className="pt-4" colSpan="4">Total</td>
                            <td className="pt-4 tabular-nums">
                                {formatCurrency(totals.value, currency)}
                            </td>
                            <td className={`pt-4 tabular-nums ${getPnLColorClass(totals.unrealized)}`}>
                                {formatCurrency(totals.unrealized, currency, { signed: true })}
                            </td>
                            <td className={`pt-4 tabular-nums ${getPnLColorClass(totals.unrealized)}`}>
                                {totals.cost > 0 && formatPercent((totals.unrealized / totals.cost) * 100, 2, { signed: true })}
                            </td>
                            <td className="pt-4"></td>
                        </tr>
                    </tfoot>
                </table>
            </div>
            <ClosedPositions rows={closed} currency={currency} onSelectSymbol={onSelectSymbol} />

        </div>
    );
}

function HoldingCard({ holding, currency, onSelectSymbol }) {
    return (
        <div className={`rounded-card border border-hairline p-4 ${holding.closed ? 'opacity-60' : ''}`}>
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => onSelectSymbol?.(holding.symbol)}
                            className="font-semibold text-gray-900 dark:text-white hover:text-cyan-600 dark:hover:text-cyan-400"
                        >
                            {holding.symbol}
                        </button>
                        {holding.closed && (
                            <span className="px-1.5 py-0.5 text-xs rounded bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-300">
                                Closed
                            </span>
                        )}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                        {formatShares(holding.quantity)} @ {formatCurrency(holding.avgCost, currency)}
                    </div>
                </div>
                <div className="text-right shrink-0">
                    <div className="font-semibold text-gray-900 dark:text-white">
                        {formatCurrency(holding.totalValue, currency)}
                    </div>
                    <div className={`text-xs font-medium ${getPnLColorClass(holding.unrealizedPnL)}`}>
                        {formatCurrency(holding.unrealizedPnL, currency, { signed: true })}
                        {!holding.closed && <>{' · '}{formatPercent(holding.unrealizedPnLPct, 1, { signed: true })}</>}
                    </div>
                    {holding.realizedPnL !== 0 && (
                        <div className={`text-xs ${getPnLColorClass(holding.realizedPnL)}`}>
                            {formatCurrency(holding.realizedPnL, currency, { signed: true })} realized
                        </div>
                    )}
                </div>
            </div>
            <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-3 pt-3 border-t border-hairline">
                <span>Now {formatCurrency(holding.currentPrice, currency)}</span>
                <span>{formatPercent(holding.weightPct, 1)} of book</span>
            </div>
        </div>
    );
}

function SortableHeader({ label, field, currentField, direction, onSort }) {
    const isActive = currentField === field;

    return (
        <th
            onClick={() => onSort(field)}
            className="pb-3 font-semibold text-gray-700 dark:text-gray-300 cursor-pointer hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors"
        >
            <div className="flex items-center gap-1">
                {label}
                <ArrowUpDown className={`w-4 h-4 ${isActive ? 'text-cyan-600 dark:text-cyan-400' : 'text-ink-faint'}`} />
            </div>
        </th>
    );
}

function HoldingRow({ holding, currency, onSelectSymbol }) {
    const isProfit = holding.unrealizedPnL >= 0;

    return (
        <tr className={`border-b border-hairline hover:bg-gray-50 dark:hover:bg-gray-700/50 ${holding.closed ? 'opacity-60' : ''}`}>
            <td className="py-3">
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => onSelectSymbol?.(holding.symbol)}
                        className="font-semibold text-gray-900 dark:text-white hover:text-cyan-600 dark:hover:text-cyan-400 hover:underline"
                    >
                        {holding.symbol}
                    </button>
                    {holding.closed && (
                        <span className="px-1.5 py-0.5 text-xs rounded bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-300">
                            Closed
                        </span>
                    )}
                </div>
                {holding.companyName && (
                    <div className="text-sm text-gray-600 dark:text-gray-400">{holding.companyName}</div>
                )}
            </td>
            <td className="py-3 text-gray-900 dark:text-white">{formatShares(holding.quantity)}</td>
            <td className="py-3 text-gray-900 dark:text-white">
                {formatCurrency(holding.avgCost, currency)}
            </td>
            <td className="py-3 text-gray-900 dark:text-white">
                {formatCurrency(holding.currentPrice, currency)}
            </td>
            <td className="py-3 text-gray-900 dark:text-white">
                {formatCurrency(holding.totalValue, currency)}
            </td>
            <td className={`py-3 font-semibold ${getPnLColorClass(holding.unrealizedPnL)}`}>
                <div className="flex items-center gap-1">
                    {isProfit ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                    {formatCurrency(holding.unrealizedPnL, currency, { signed: true })}
                </div>
                {holding.realizedPnL !== 0 && (
                    <div className={`text-xs font-normal ${getPnLColorClass(holding.realizedPnL)}`}>
                        {formatCurrency(holding.realizedPnL, currency, { signed: true })} realized
                    </div>
                )}
            </td>
            <td className={`py-3 font-semibold ${getPnLColorClass(holding.unrealizedPnL)}`}>
                {holding.closed ? '—' : formatPercent(holding.unrealizedPnLPct, 2, { signed: true })}
            </td>
            <td className="py-3 text-gray-600 dark:text-gray-400">
                {formatPercent(holding.weightPct, 1)}
            </td>
        </tr>
    );
}


/**
 * Positions with nothing left in them. Kept out of the holdings table because
 * every column there - shares, price, value, weight - is zero for a closed
 * position, and its unrealised P/L of zero rendered as a green gain beside a
 * loss it had actually taken.
 */
function ClosedPositions({ rows, currency, onSelectSymbol }) {
    const [open, setOpen] = useState(false);
    if (!rows.length) return null;

    const total = rows.reduce((sum, r) => sum + (r.realizedPnL || 0) + (r.dividendsReceived || 0), 0);

    return (
        <div className="border-t border-hairline pt-3">
            <button
                onClick={() => setOpen(!open)}
                className="w-full flex items-center justify-between text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
            >
                <span className="flex items-center gap-1.5">
                    {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                    {rows.length} closed {rows.length === 1 ? 'position' : 'positions'}
                </span>
                <span className={`font-semibold ${getPnLColorClass(total)}`}>
                    {formatCurrency(total, currency, { signed: true })} realised
                </span>
            </button>

            {open && (
                <div className="mt-3 grid gap-x-6 gap-y-1.5 sm:grid-cols-2 lg:grid-cols-3">
                    {rows.map((r) => {
                        const div = r.dividendsReceived || 0;
                        const took = (r.realizedPnL || 0) + div;
                        // A symbol can appear here on dividends alone, never
                        // having been traded - showing only realised P/L made
                        // those read as a flat zero.
                        const only = div > 0 && !r.realizedPnL;
                        return (
                            <button
                                key={r.symbol}
                                onClick={() => onSelectSymbol?.(r.symbol)}
                                className="flex items-baseline justify-between gap-3 text-sm text-left hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded px-1 -mx-1"
                            >
                                <span className="text-gray-700 dark:text-gray-300 truncate">
                                    {r.symbol}
                                    {only && <span className="text-xs text-ink-faint"> dividend only</span>}
                                </span>
                                <span className={`shrink-0 tabular-nums ${getPnLColorClass(took)}`}>
                                    {formatCurrency(took, currency, { signed: true })}
                                </span>
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
