import { useState } from 'react';
import { X } from 'lucide-react';
import api from '../../services/api';
import { SymbolInput } from '../../ui/SymbolInput';
import toast from 'react-hot-toast';
import { currencySymbol } from '../../utils/portfolioUtils';

export default function EditTransactionModal({ portfolioId, transaction, currency, onClose, onUpdated }) {
    const [formData, setFormData] = useState({
        type: transaction.type || 'BUY',
        symbol: transaction.symbol || '',
        quantity: transaction.quantity || '',
        price: transaction.price || '',
        fees: transaction.fees || 0,
        otherCharges: transaction.otherCharges || 0,
        executedAt: transaction.executedAt ? new Date(transaction.executedAt).toISOString().split('T')[0] : '',
        notes: transaction.notes || '',
        dividendCash: transaction.dividendCash || '',
        dividendType: transaction.dividendType || 'CASH',
        cashAmount: transaction.cashAmount || ''
    });
    const selectStock = (stock) => {
        const updates = { symbol: stock.symbol };

        // Auto-fill price if available and transaction type is BUY or SELL
        if (stock.currentPrice && ['BUY', 'SELL'].includes(formData.type)) {
            updates.price = stock.currentPrice;
        }

        setFormData({ ...formData, ...updates });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        try {
            // Blank fields belong to other types; sending them makes Mongoose
            // cast '' to a number.
            const payload = Object.fromEntries(
                Object.entries(formData).filter(([, v]) => v !== '')
            );
            await api.put(`/portfolios/${portfolioId}/transactions/${transaction._id}`, payload);
            toast.success('Transaction updated');
            onUpdated();
            onClose();
        } catch (error) {
            console.error('Error updating transaction:', error);
            toast.error(error.response?.data?.message || 'Failed to update transaction');
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-surface rounded-card shadow-dialog max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
                <div className="sticky top-0 bg-surface border-b border-hairline px-6 py-4 flex items-center justify-between">
                    <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Edit Transaction</h2>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                    >
                        <X className="w-6 h-6" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    {/* Transaction Type */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Transaction Type
                        </label>
                        <select
                            value={formData.type}
                            onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-cyan-500"
                            disabled
                        >
                            <option value="BUY">Buy</option>
                            <option value="SELL">Sell</option>
                            <option value="DIV">Dividend</option>
                        </select>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Type cannot be changed</p>
                    </div>

                    {/* Symbol */}
                    {['BUY', 'SELL', 'DIV'].includes(formData.type) && (
                        <div className="relative">
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                Symbol *
                            </label>
                            <SymbolInput
                                required
                                value={formData.symbol}
                                onChange={(v) => setFormData({ ...formData, symbol: v })}
                                onSelect={selectStock}
                            />
                        </div>
                    )}

                    {/* Quantity and Price for BUY/SELL */}
                    {['BUY', 'SELL'].includes(formData.type) && (
                        <>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    Quantity *
                                </label>
                                <input
                                    type="number"
                                    value={formData.quantity}
                                    onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-cyan-500"
                                    placeholder="100"
                                    min="0"
                                    step="1"
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    Price per Share *
                                </label>
                                <div className="flex items-center gap-2">
                                    <span className="text-gray-600 dark:text-gray-400">{currencySymbol(currency)}</span>
                                    <input
                                        type="number"
                                        value={formData.price}
                                        onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                                        className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-cyan-500"
                                        placeholder="85.50"
                                        min="0"
                                        step="0.01"
                                        required
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    Fees/Commission
                                </label>
                                <div className="flex items-center gap-2">
                                    <span className="text-gray-600 dark:text-gray-400">{currencySymbol(currency)}</span>
                                    <input
                                        type="number"
                                        value={formData.fees}
                                        onChange={(e) => setFormData({ ...formData, fees: e.target.value })}
                                        className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-cyan-500"
                                        placeholder="50"
                                        min="0"
                                        step="0.01"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                    Other charges
                                </label>
                                <div className="flex items-center gap-2">
                                    <span className="text-gray-600 dark:text-gray-400">{currencySymbol(currency)}</span>
                                    <input
                                        type="number"
                                        value={formData.otherCharges}
                                        onChange={(e) => setFormData({ ...formData, otherCharges: e.target.value })}
                                        className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-cyan-500"
                                        placeholder="0"
                                        min="0"
                                        step="0.01"
                                    />
                                </div>
                            </div>
                        </>
                    )}

                    {['DEPOSIT', 'WITHDRAW'].includes(formData.type) && (
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                Amount ({currencySymbol(currency)}) *
                            </label>
                            <input
                                type="number"
                                step="0.01"
                                value={formData.cashAmount}
                                onChange={(e) => setFormData({ ...formData, cashAmount: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-cyan-500"
                                required
                            />
                        </div>
                    )}

                    {/* Dividend Amount */}
                    {formData.type === 'DIV' && (
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                Dividend Amount *
                            </label>
                            <div className="flex items-center gap-2">
                                <span className="text-gray-600 dark:text-gray-400">{currencySymbol(currency)}</span>
                                <input
                                    type="number"
                                    value={formData.dividendCash}
                                    onChange={(e) => setFormData({ ...formData, dividendCash: e.target.value })}
                                    className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-cyan-500"
                                    placeholder="500"
                                    min="0"
                                    step="0.01"
                                    required
                                />
                            </div>
                        </div>
                    )}

                    {/* Execution Date */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
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

                    {/* Notes */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Notes
                        </label>
                        <textarea
                            value={formData.notes}
                            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-cyan-500"
                            rows="3"
                            placeholder="Optional notes..."
                        />
                    </div>

                    <div className="flex gap-3 pt-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="flex-1 px-4 py-2 bg-cyan-500 text-white rounded-lg hover:bg-cyan-600 transition-colors"
                        >
                            Update Transaction
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
