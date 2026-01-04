import { useState, useEffect } from 'react';
import { X, Plus, Trash2 } from 'lucide-react';
import api from '../../services/api';
import toast from 'react-hot-toast';

export default function PolicyEditorModal({ portfolioId, existingPolicy, onClose, onSaved }) {
    const [formData, setFormData] = useState({
        strategyType: 'EQUAL_WEIGHT',
        targets: [],
        rebalanceThreshold: 10,
        minCashReserve: 0
    });
    const [newTarget, setNewTarget] = useState({ symbol: '', targetWeight: '' });

    useEffect(() => {
        if (existingPolicy) {
            setFormData({
                strategyType: existingPolicy.strategyType || 'EQUAL_WEIGHT',
                targets: existingPolicy.targets || [],
                rebalanceThreshold: existingPolicy.rebalanceThreshold || 10,
                minCashReserve: existingPolicy.minCashReserve || 0
            });
        }
    }, [existingPolicy]);

    const addTarget = () => {
        if (!newTarget.symbol || !newTarget.targetWeight) {
            toast.error('Please enter symbol and target weight');
            return;
        }

        const weight = parseFloat(newTarget.targetWeight);
        if (weight <= 0 || weight > 100) {
            toast.error('Target weight must be between 0 and 100');
            return;
        }

        setFormData(prev => ({
            ...prev,
            targets: [...prev.targets, { symbol: newTarget.symbol.toUpperCase(), targetWeight: weight }]
        }));
        setNewTarget({ symbol: '', targetWeight: '' });
    };

    const removeTarget = (index) => {
        setFormData(prev => ({
            ...prev,
            targets: prev.targets.filter((_, i) => i !== index)
        }));
    };

    const handleSave = async () => {
        try {
            const totalWeight = formData.targets.reduce((sum, t) => sum + t.targetWeight, 0);
            if (Math.abs(totalWeight - 100) > 0.01) {
                toast.error(`Target weights must sum to 100% (currently ${totalWeight.toFixed(1)}%)`);
                return;
            }

            await api.put(`/portfolios/${portfolioId}/policy`, formData);
            toast.success('Allocation policy saved');
            onSaved();
            onClose();
        } catch (error) {
            console.error('Error saving policy:', error);
            toast.error(error.response?.data?.message || 'Failed to save policy');
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
                <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex items-center justify-between">
                    <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Allocation Policy</h2>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                    >
                        <X className="w-6 h-6" />
                    </button>
                </div>

                <div className="p-6 space-y-6">
                    {/* Strategy Type */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Strategy Type
                        </label>
                        <select
                            value={formData.strategyType}
                            onChange={(e) => setFormData({ ...formData, strategyType: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-cyan-500"
                        >
                            <option value="EQUAL_WEIGHT">Equal Weight</option>
                            <option value="MARKET_CAP_WEIGHT">Market Cap Weighted</option>
                            <option value="RISK_ADJUSTED">Risk Adjusted</option>
                            <option value="CUSTOM">Custom Targets</option>
                        </select>
                    </div>

                    {/* Target Allocations */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Target Allocations
                        </label>

                        {/* Existing Targets */}
                        <div className="space-y-2 mb-4">
                            {formData.targets.map((target, index) => (
                                <div key={index} className="flex items-center gap-2 bg-gray-50 dark:bg-gray-700 p-3 rounded-lg">
                                    <div className="flex-1">
                                        <span className="font-semibold text-gray-900 dark:text-white">{target.symbol}</span>
                                    </div>
                                    <div className="text-right">
                                        <span className="text-gray-600 dark:text-gray-400">{target.targetWeight}%</span>
                                    </div>
                                    <button
                                        onClick={() => removeTarget(index)}
                                        className="text-red-600 hover:bg-red-50 p-2 rounded transition-colors"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            ))}
                        </div>

                        {/* Add New Target */}
                        <div className="flex gap-2">
                            <input
                                type="text"
                                placeholder="Symbol (e.g., OGDC)"
                                value={newTarget.symbol}
                                onChange={(e) => setNewTarget({ ...newTarget, symbol: e.target.value })}
                                className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-cyan-500"
                            />
                            <input
                                type="number"
                                placeholder="Weight %"
                                value={newTarget.targetWeight}
                                onChange={(e) => setNewTarget({ ...newTarget, targetWeight: e.target.value })}
                                className="w-24 px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-cyan-500"
                                min="0"
                                max="100"
                                step="0.1"
                            />
                            <button
                                onClick={addTarget}
                                className="bg-cyan-500 text-white px-4 py-2 rounded-lg hover:bg-cyan-600 flex items-center gap-1"
                            >
                                <Plus className="w-4 h-4" />
                                Add
                            </button>
                        </div>

                        {formData.targets.length > 0 && (
                            <div className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                                Total: {formData.targets.reduce((sum, t) => sum + t.targetWeight, 0).toFixed(1)}%
                                {Math.abs(formData.targets.reduce((sum, t) => sum + t.targetWeight, 0) - 100) > 0.01 && (
                                    <span className="text-red-600 ml-2">⚠️ Must equal 100%</span>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Rebalance Threshold */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Rebalance Threshold (%)
                        </label>
                        <input
                            type="number"
                            value={formData.rebalanceThreshold}
                            onChange={(e) => setFormData({ ...formData, rebalanceThreshold: e.target.value === '' ? '' : parseFloat(e.target.value) })}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-cyan-500"
                            min="1"
                            max="50"
                            step="1"
                        />
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                            Alert when any position drifts more than this percentage from target
                        </p>
                    </div>

                    {/* Min Cash Reserve */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Minimum Cash Reserve (%)
                        </label>
                        <input
                            type="number"
                            value={formData.minCashReserve}
                            onChange={(e) => setFormData({ ...formData, minCashReserve: e.target.value === '' ? '' : parseFloat(e.target.value) })}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-cyan-500"
                            min="0"
                            max="100"
                            step="1"
                        />
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                            Minimum cash to keep available for opportunities
                        </p>
                    </div>
                </div>

                <div className="sticky bottom-0 bg-gray-50 dark:bg-gray-700 px-6 py-4 flex justify-end gap-3 border-t border-gray-200 dark:border-gray-600">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        className="px-6 py-2 bg-cyan-500 text-white rounded-lg hover:bg-cyan-600 transition-colors"
                    >
                        Save Policy
                    </button>
                </div>
            </div>
        </div>
    );
}
