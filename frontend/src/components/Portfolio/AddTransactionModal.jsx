import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import api from '../../services/api';
import { searchStocks } from '../../services/stocks';
import toast from 'react-hot-toast';
import { formatCurrency, formatShares } from '../../utils/portfolioUtils';
import { chargesFor, slabFor, describeSlab } from '../../utils/commission';

export default function AddTransactionModal({ portfolioId, currency, commissionSlabs = [],
    charges: portfolioCharges, onClose, onAdded }) {
    const [formData, setFormData] = useState({
        type: 'BUY',
        symbol: '',
        quantity: '',
        price: '',
        fees: '',
        otherCharges: '',
        // Cash movements and dividends share one Amount input.
        amount: '',
        executedAt: new Date().toISOString().slice(0, 10),
        notes: ''
    });
    const [submitting, setSubmitting] = useState(false);
    const [stockSuggestions, setStockSuggestions] = useState([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [holdings, setHoldings] = useState([]);

    useEffect(() => {
        api.get(`/portfolios/${portfolioId}/holdings`)
            .then(res => setHoldings((res.data.data || []).filter(h => h.quantity > 0)))
            .catch(() => setHoldings([]));
    }, [portfolioId]);

    const isSell = formData.type === 'SELL';
    const isTrade = ['BUY', 'SELL'].includes(formData.type);
    const isRatio = ['SPLIT', 'BONUS'].includes(formData.type);
    const isCash = ['DEPOSIT', 'WITHDRAW'].includes(formData.type);
    const isDividend = formData.type === 'DIV';
    const pickFromHoldings = isSell || isRatio;
    const owned = holdings.find(h => h.symbol === formData.symbol);
    const ownedQty = owned?.quantity ?? 0;
    const overSelling = isSell && formData.quantity && parseFloat(formData.quantity) > ownedQty;

    // Brokerage follows the portfolio's slab, so it is derived rather than
    // typed. Entering a per-share rate as a flat fee understates cost basis
    // and inflates every gain the portfolio reports.
    const charges = chargesFor({
        price: formData.price,
        quantity: formData.quantity,
        slabs: commissionSlabs,
        charges: portfolioCharges,
        side: formData.type
    });
    const suggestedFee = charges.total;
    const matchedSlab = slabFor(formData.price, commissionSlabs);
    const gross = (parseFloat(formData.quantity) || 0) * (parseFloat(formData.price) || 0);
    const entered = (parseFloat(formData.fees) || 0) + (parseFloat(formData.otherCharges) || 0);
    // Tracked explicitly rather than inferred from an empty field: the moment
    // the prefill wrote anything the field stopped being empty, so the fee
    // froze at whatever half-typed quantity produced it.
    const [feeEdited, setFeeEdited] = useState(false);

    // Brokerage and the statutory charges go in separate fields, as they do on
    // a contract note - rolling them together hides what the broker took.
    const statutory = suggestedFee - charges.brokerage;

    useEffect(() => {
        if (isTrade && !feeEdited && suggestedFee > 0) {
            setFormData(f => ({
                ...f,
                fees: charges.brokerage.toFixed(2),
                otherCharges: statutory > 0 ? statutory.toFixed(2) : ''
            }));
        }
    }, [suggestedFee, charges.brokerage, statutory, isTrade, feeEdited]);

    // A symbol picked for BUY may not be held, so clear it when switching to SELL.
    const changeType = (type) => {
        const needsHolding = ['SELL', 'SPLIT', 'BONUS'].includes(type);
        const keep = !needsHolding || holdings.some(h => h.symbol === formData.symbol);
        setFormData({ ...formData, type, symbol: keep ? formData.symbol : '', quantity: '' });
    };

    const selectHolding = (symbol) => {
        const h = holdings.find(x => x.symbol === symbol);
        setFormData({ ...formData, symbol, price: h?.currentPrice ?? formData.price });
    };

    const handleSymbolChange = async (value) => {
        setFormData({ ...formData, symbol: value.toUpperCase() });

        if (value.length >= 1) {
            try {
                const response = await searchStocks(value);
                setStockSuggestions(response.data);
                setShowSuggestions(true);
            } catch (error) {
                console.error('Error searching stocks:', error);
            }
        } else {
            setStockSuggestions([]);
            setShowSuggestions(false);
        }
    };

    const selectStock = (stock) => {
        const updates = { symbol: stock.symbol };

        // Auto-fill price if available and transaction type is BUY or SELL
        if (stock.currentPrice && ['BUY', 'SELL'].includes(formData.type)) {
            updates.price = stock.currentPrice;
        }

        setFormData({ ...formData, ...updates });
        setShowSuggestions(false);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (overSelling) {
            toast.error(`You only own ${formatShares(ownedQty)} ${formData.symbol}`);
            return;
        }
        setSubmitting(true);

        try {
            const payload = isCash
                ? { type: formData.type, cashAmount: parseFloat(formData.amount), executedAt: formData.executedAt, notes: formData.notes }
                : isDividend
                ? { type: formData.type, symbol: formData.symbol, dividendCash: parseFloat(formData.amount), dividendType: 'CASH', executedAt: formData.executedAt, notes: formData.notes }
                : isRatio
                ? { type: formData.type, symbol: formData.symbol, ratio: formData.ratio, executedAt: formData.executedAt, notes: formData.notes }
                : {
                    ...formData,
                    quantity: parseFloat(formData.quantity),
                    price: parseFloat(formData.price),
                    fees: parseFloat(formData.fees) || 0,
                    otherCharges: parseFloat(formData.otherCharges) || 0
                };

            await api.post(`/portfolios/${portfolioId}/transactions`, payload);
            toast.success('Transaction added successfully');
            onAdded();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to add transaction');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-surface rounded-card p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">Add Transaction</h2>
                    <button onClick={onClose} className="p-1 hover:bg-surface-muted rounded-control">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Transaction Type *
                        </label>
                        <select
                            value={formData.type}
                            onChange={(e) => changeType(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-cyan-500"
                            required
                        >
                            <option value="BUY">Buy</option>
                            <option value="SELL">Sell</option>
                            <option value="DIV">Dividend</option>
                            <option value="DEPOSIT">Cash Deposit</option>
                            <option value="WITHDRAW">Cash Withdrawal</option>
                            <option value="SPLIT">Stock Split</option>
                            <option value="BONUS">Bonus Shares</option>
                        </select>
                    </div>

                    {!isCash && (
                    <div className="relative">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Symbol *
                        </label>
                        {pickFromHoldings ? (
                            holdings.length === 0 ? (
                                <p className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400 border border-dashed border-gray-300 dark:border-gray-600 rounded-lg">
                                    No holdings yet.
                                </p>
                            ) : (
                                <select
                                    value={formData.symbol}
                                    onChange={(e) => selectHolding(e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-cyan-500"
                                    required
                                >
                                    <option value="">Select a holding...</option>
                                    {holdings.map(h => (
                                        <option key={h.symbol} value={h.symbol}>
                                            {h.symbol} — {formatShares(h.quantity)} shares
                                        </option>
                                    ))}
                                </select>
                            )
                        ) : (
                            <input
                                type="text"
                                value={formData.symbol}
                                onChange={(e) => handleSymbolChange(e.target.value)}
                                onFocus={() => formData.symbol && setShowSuggestions(true)}
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-cyan-500 uppercase"
                                placeholder="e.g., OGDC"
                                required
                            />
                        )}
                        {!pickFromHoldings && showSuggestions && stockSuggestions.length > 0 && (
                            <div className="absolute z-10 w-full mt-1 bg-surface border border-gray-300 dark:border-gray-600 rounded-lg shadow-card max-h-60 overflow-y-auto">
                                {stockSuggestions.map((stock) => (
                                    <button
                                        key={stock._id}
                                        type="button"
                                        onClick={() => selectStock(stock)}
                                        className="w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                                    >
                                        <div className="font-bold text-cyan-600 dark:text-cyan-400">{stock.symbol}</div>
                                        <div className="text-sm text-gray-600 dark:text-gray-400">{stock.companyName}</div>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    )}

                    {isRatio && (
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Ratio *
                            </label>
                            <input
                                type="text"
                                value={formData.ratio || ''}
                                onChange={(e) => setFormData({ ...formData, ratio: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-cyan-500"
                                placeholder={formData.type === 'SPLIT' ? 'e.g., 2:1' : 'e.g., 20%'}
                                required
                            />
                            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                                {formData.type === 'SPLIT'
                                    ? '2:1 means each share becomes two.'
                                    : '20% means 20 extra shares per 100 held.'}
                            </p>
                        </div>
                    )}

                    {isTrade && (
                        <>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                        Quantity *
                                    </label>
                                    <input
                                        type="number"
                                        step="1"
                                        max={isSell && formData.symbol ? ownedQty : undefined}
                                        value={formData.quantity}
                                        onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                                        className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-cyan-500 dark:bg-gray-700 dark:text-white ${overSelling ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'}`}
                                        required
                                    />
                                    {isSell && formData.symbol && (
                                        <div className="mt-1 flex items-center justify-between text-xs">
                                            <span className={overSelling ? 'text-red-600 dark:text-red-400' : 'text-gray-500 dark:text-gray-400'}>
                                                You own {formatShares(ownedQty)}
                                            </span>
                                            <button
                                                type="button"
                                                onClick={() => setFormData({ ...formData, quantity: String(ownedQty) })}
                                                className="text-cyan-600 dark:text-cyan-400 hover:underline"
                                            >
                                                Sell all
                                            </button>
                                        </div>
                                    )}
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                        Price *
                                    </label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={formData.price}
                                        onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-cyan-500"
                                        required
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    Commission
                                </label>
                                <input
                                    type="number"
                                    step="0.01"
                                    value={formData.fees}
                                    onChange={(e) => { setFeeEdited(true); setFormData({ ...formData, fees: e.target.value }); }}
                                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-cyan-500"
                                    placeholder="0.00"
                                />
                                {isTrade && !commissionSlabs.length && (
                                    <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
                                        No commission slab on this portfolio — fees will not be filled in.
                                    </p>
                                )}
                                {matchedSlab && suggestedFee > 0 && (
                                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                                        {describeSlab(matchedSlab)} {formatCurrency(charges.brokerage, currency)}
                                        {charges.lines.map(l => ` + ${l.name} ${formatCurrency(l.amount, currency)}`).join('')}
                                        {' = '}<strong>{formatCurrency(suggestedFee, currency)}</strong>
                                    </p>
                                )}
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    Other charges
                                </label>
                                <input
                                    type="number"
                                    step="0.01"
                                    value={formData.otherCharges}
                                    onChange={(e) => { setFeeEdited(true); setFormData({ ...formData, otherCharges: e.target.value }); }}
                                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-cyan-500"
                                    placeholder="0.00"
                                />
                            </div>
                            </div>

                            {formData.quantity && formData.price && (
                                <div className="bg-surface-muted p-3 rounded-lg space-y-1">
                                    <Row label="Gross" value={formatCurrency(gross, currency)} />
                                    {entered > 0 && (
                                        <Row
                                            label={isSell ? 'Less charges' : 'Plus charges'}
                                            value={`${isSell ? '−' : '+'} ${formatCurrency(entered, currency)}`}
                                        />
                                    )}
                                    <div className="flex justify-between pt-1 border-t border-gray-200 dark:border-gray-600">
                                        <span className="text-sm text-gray-600 dark:text-gray-400">
                                            {isSell ? 'Net proceeds' : 'Total cost'}
                                        </span>
                                        <span className="text-lg font-semibold text-gray-900 dark:text-white">
                                            {formatCurrency(isSell ? gross - entered : gross + entered, currency)}
                                        </span>
                                    </div>
                                </div>
                            )}
                        </>
                    )}

                    {(isDividend || isCash) && (
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Amount *
                            </label>
                            <input
                                type="number"
                                step="0.01"
                                value={formData.amount}
                                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-cyan-500"
                                required
                            />
                        </div>
                    )}

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Execution Date *
                        </label>
                        <input
                            type="date"
                            value={formData.executedAt}
                            onChange={(e) => setFormData({ ...formData, executedAt: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-cyan-500"
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Notes
                        </label>
                        <textarea
                            value={formData.notes}
                            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-cyan-500"
                            rows="2"
                            placeholder="Optional notes..."
                        />
                    </div>

                    <div className="flex gap-3 pt-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={submitting || overSelling}
                            className="flex-1 px-4 py-2 bg-cyan-500 text-white rounded-lg hover:bg-cyan-600 disabled:opacity-50"
                        >
                            {submitting ? 'Adding...' : 'Add Transaction'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}


function Row({ label, value }) {
    return (
        <div className="flex justify-between text-sm">
            <span className="text-gray-600 dark:text-gray-400">{label}</span>
            <span className="text-gray-900 dark:text-white">{value}</span>
        </div>
    );
}
