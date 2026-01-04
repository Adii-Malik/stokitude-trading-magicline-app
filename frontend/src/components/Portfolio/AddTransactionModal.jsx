import { useState } from 'react';
import { X } from 'lucide-react';
import api from '../../services/api';
import { searchStocks } from '../../services/stocks';
import toast from 'react-hot-toast';

export default function AddTransactionModal({ portfolioId, currency, onClose, onAdded }) {
    const [formData, setFormData] = useState({
        type: 'BUY',
        symbol: '',
        quantity: '',
        price: '',
        fees: '',
        executedAt: new Date().toISOString().slice(0, 10),
        notes: ''
    });
    const [submitting, setSubmitting] = useState(false);
    const [stockSuggestions, setStockSuggestions] = useState([]);
    const [showSuggestions, setShowSuggestions] = useState(false);

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
        setSubmitting(true);

        try {
            const payload = {
                ...formData,
                quantity: parseFloat(formData.quantity),
                price: parseFloat(formData.price),
                fees: parseFloat(formData.fees) || 0
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

    const isTrade = ['BUY', 'SELL'].includes(formData.type);
    const isCash = ['DEPOSIT', 'WITHDRAW'].includes(formData.type);

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">Add Transaction</h2>
                    <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
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
                            onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-cyan-500"
                            required
                        >
                            <option value="BUY">Buy</option>
                            <option value="SELL">Sell</option>
                            <option value="DIV">Dividend</option>
                            <option value="DEPOSIT">Cash Deposit</option>
                            <option value="WITHDRAW">Cash Withdrawal</option>
                        </select>
                    </div>

                    <div className="relative">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Symbol *
                        </label>
                        <input
                            type="text"
                            value={formData.symbol}
                            onChange={(e) => handleSymbolChange(e.target.value)}
                            onFocus={() => formData.symbol && setShowSuggestions(true)}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-cyan-500 uppercase"
                            placeholder="e.g., OGDC"
                            required
                        />
                        {showSuggestions && stockSuggestions.length > 0 && (
                            <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg max-h-60 overflow-y-auto">
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
                                        value={formData.quantity}
                                        onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-cyan-500"
                                        required
                                    />
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

                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    Fees/Commission
                                </label>
                                <input
                                    type="number"
                                    step="0.01"
                                    value={formData.fees}
                                    onChange={(e) => setFormData({ ...formData, fees: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-cyan-500"
                                    placeholder="0.00"
                                />
                            </div>

                            {formData.quantity && formData.price && (
                                <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded-lg">
                                    <div className="text-sm text-gray-600 dark:text-gray-400">Total Amount</div>
                                    <div className="text-lg font-semibold text-gray-900 dark:text-white">
                                        {currency === 'USD' ? '$' : 'Rs.'} {(parseFloat(formData.quantity) * parseFloat(formData.price)).toLocaleString()}
                                    </div>
                                </div>
                            )}
                        </>
                    )}

                    {(formData.type === 'DIV' || isCash) && (
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Amount *
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
                            disabled={submitting}
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
