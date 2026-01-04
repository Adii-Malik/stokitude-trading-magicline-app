import { useState } from 'react';
import { X } from 'lucide-react';
import api from '../../services/api';
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
            <div className="bg-white rounded-lg p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-bold text-gray-900">Add Transaction</h2>
                    <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Transaction Type *
                        </label>
                        <select
                            value={formData.type}
                            onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                            required
                        >
                            <option value="BUY">Buy</option>
                            <option value="SELL">Sell</option>
                            <option value="DIV">Dividend</option>
                            <option value="DEPOSIT">Cash Deposit</option>
                            <option value="WITHDRAW">Cash Withdrawal</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Symbol *
                        </label>
                        <input
                            type="text"
                            value={formData.symbol}
                            onChange={(e) => setFormData({ ...formData, symbol: e.target.value.toUpperCase() })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 uppercase"
                            placeholder="e.g., OGDC"
                            required
                        />
                    </div>

                    {isTrade && (
                        <>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Quantity *
                                    </label>
                                    <input
                                        type="number"
                                        step="1"
                                        value={formData.quantity}
                                        onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Price *
                                    </label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={formData.price}
                                        onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                                        required
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Fees/Commission
                                </label>
                                <input
                                    type="number"
                                    step="0.01"
                                    value={formData.fees}
                                    onChange={(e) => setFormData({ ...formData, fees: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                                    placeholder="0.00"
                                />
                            </div>

                            {formData.quantity && formData.price && (
                                <div className="bg-gray-50 p-3 rounded-lg">
                                    <div className="text-sm text-gray-600">Total Amount</div>
                                    <div className="text-lg font-semibold text-gray-900">
                                        {currency === 'USD' ? '$' : 'Rs.'} {(parseFloat(formData.quantity) * parseFloat(formData.price)).toLocaleString()}
                                    </div>
                                </div>
                            )}
                        </>
                    )}

                    {(formData.type === 'DIV' || isCash) && (
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Amount *
                            </label>
                            <input
                                type="number"
                                step="0.01"
                                value={formData.price}
                                onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                                required
                            />
                        </div>
                    )}

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Execution Date *
                        </label>
                        <input
                            type="date"
                            value={formData.executedAt}
                            onChange={(e) => setFormData({ ...formData, executedAt: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Notes
                        </label>
                        <textarea
                            value={formData.notes}
                            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                            rows="2"
                            placeholder="Optional notes..."
                        />
                    </div>

                    <div className="flex gap-3 pt-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={submitting}
                            className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50"
                        >
                            {submitting ? 'Adding...' : 'Add Transaction'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
