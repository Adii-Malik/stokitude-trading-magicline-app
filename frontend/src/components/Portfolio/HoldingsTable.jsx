import { useState, useEffect } from 'react';
import { Search, ArrowUpDown, TrendingUp, TrendingDown } from 'lucide-react';
import api from '../../services/api';
import toast from 'react-hot-toast';
import { formatCurrency, formatPercent, formatShares, getPnLColorClass } from '../../utils/portfolioUtils';

export default function HoldingsTable({ portfolioId, currency }) {
    const [holdings, setHoldings] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [sortField, setSortField] = useState('totalValue');
    const [sortDirection, setSortDirection] = useState('desc');

    useEffect(() => {
        loadHoldings();
    }, [portfolioId]);

    const loadHoldings = async () => {
        try {
            const response = await api.get(`/portfolios/${portfolioId}/holdings`);
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

    const filteredAndSorted = holdings
        .filter(h =>
            h.symbol.toLowerCase().includes(searchTerm.toLowerCase()) ||
            h.companyName?.toLowerCase().includes(searchTerm.toLowerCase())
        )
        .sort((a, b) => {
            const multiplier = sortDirection === 'asc' ? 1 : -1;
            return (a[sortField] - b[sortField]) * multiplier;
        });

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
                <p className="text-gray-600">No holdings yet. Add your first transaction to get started.</p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Search */}
            <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                    type="text"
                    placeholder="Search by symbol or company name..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                />
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
                <table className="w-full">
                    <thead>
                        <tr className="border-b border-gray-200 dark:border-gray-700 text-left">
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
                                label="Total P/L"
                                field="totalPnL"
                                currentField={sortField}
                                direction={sortDirection}
                                onSort={handleSort}
                            />
                            <SortableHeader
                                label="P/L %"
                                field="totalPnLPct"
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
                            <HoldingRow key={holding.symbol} holding={holding} currency={currency} />
                        ))}
                    </tbody>
                    <tfoot>
                        <tr className="border-t-2 border-gray-300 font-semibold">
                            <td className="pt-4" colSpan="4">Total</td>
                            <td className="pt-4">
                                {formatCurrency(filteredAndSorted.reduce((sum, h) => sum + h.totalValue, 0), currency)}
                            </td>
                            <td className="pt-4">
                                {formatCurrency(filteredAndSorted.reduce((sum, h) => sum + h.totalPnL, 0), currency)}
                            </td>
                            <td className="pt-4" colSpan="2"></td>
                        </tr>
                    </tfoot>
                </table>
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
                <ArrowUpDown className={`w-4 h-4 ${isActive ? 'text-cyan-600 dark:text-cyan-400' : 'text-gray-400'}`} />
            </div>
        </th>
    );
}

function HoldingRow({ holding, currency }) {
    const isProfit = holding.totalPnL >= 0;

    return (
        <tr className="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50">
            <td className="py-3">
                <div className="font-semibold text-gray-900 dark:text-white">{holding.symbol}</div>
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
            <td className={`py-3 font-semibold ${getPnLColorClass(holding.totalPnL)}`}>
                <div className="flex items-center gap-1">
                    {isProfit ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                    {formatCurrency(holding.totalPnL, currency, { signed: true })}
                </div>
            </td>
            <td className={`py-3 font-semibold ${getPnLColorClass(holding.totalPnL)}`}>
                {formatPercent(holding.totalPnLPct, 2, { signed: true })}
            </td>
            <td className="py-3 text-gray-600 dark:text-gray-400">
                {formatPercent(holding.weightPct, 1)}
            </td>
        </tr>
    );
}
