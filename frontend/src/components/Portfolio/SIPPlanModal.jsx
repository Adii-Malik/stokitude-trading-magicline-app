import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import api from '../../services/api';
import toast from 'react-hot-toast';
import { currencySymbol } from '../../utils/portfolioUtils';

export default function SIPPlanModal({ portfolioId, currency, existingPlan, onClose, onSaved }) {
    const [formData, setFormData] = useState({
        monthlyAmount: '',
        dayOfMonth: 1,
        isActive: true
    });

    useEffect(() => {
        if (existingPlan) {
            setFormData({
                monthlyAmount: existingPlan.monthlyAmount || '',
                dayOfMonth: existingPlan.dayOfMonth || 1,
                isActive: existingPlan.isActive !== undefined ? existingPlan.isActive : true
            });
        }
    }, [existingPlan]);

    const handleSave = async () => {
        try {
            if (!formData.monthlyAmount || formData.monthlyAmount <= 0) {
                toast.error('Please enter a valid monthly amount');
                return;
            }

            await api.put(`/portfolios/${portfolioId}/sip-plan`, formData);
            toast.success('SIP plan saved');
            onSaved();
            onClose();
        } catch (error) {
            console.error('Error saving SIP plan:', error);
            toast.error(error.response?.data?.message || 'Failed to save SIP plan');
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full mx-4">
                <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex items-center justify-between rounded-t-xl">
                    <h2 className="text-xl font-semibold text-gray-900 dark:text-white">SIP Plan Setup</h2>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                    >
                        <X className="w-6 h-6" />
                    </button>
                </div>

                <div className="p-6 space-y-4">
                    {/* Monthly Amount */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Monthly Investment Amount
                        </label>
                        <div className="flex items-center gap-2">
                            <span className="text-gray-600 dark:text-gray-400">{currencySymbol(currency)}</span>
                            <input
                                type="number"
                                value={formData.monthlyAmount}
                                onChange={(e) => setFormData({ ...formData, monthlyAmount: e.target.value === '' ? '' : parseFloat(e.target.value) })}
                                className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-cyan-500"
                                placeholder="e.g., 50000"
                                min="0"
                                step="1000"
                            />
                        </div>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                            Amount to invest every month via SIP
                        </p>
                    </div>

                    {/* Day of Month */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Investment Day of Month
                        </label>
                        <select
                            value={formData.dayOfMonth}
                            onChange={(e) => setFormData({ ...formData, dayOfMonth: parseInt(e.target.value) })}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-cyan-500"
                        >
                            {Array.from({ length: 28 }, (_, i) => i + 1).map(day => (
                                <option key={day} value={day}>
                                    {day}{day === 1 ? 'st' : day === 2 ? 'nd' : day === 3 ? 'rd' : 'th'} of every month
                                </option>
                            ))}
                        </select>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                            When to execute monthly SIP investments
                        </p>
                    </div>

                    {/* Active Toggle */}
                    <div className="flex items-center gap-3 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                        <input
                            type="checkbox"
                            id="isActive"
                            checked={formData.isActive}
                            onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                            className="w-5 h-5 text-cyan-600 focus:ring-2 focus:ring-cyan-500 rounded"
                        />
                        <label htmlFor="isActive" className="text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
                            <span className="font-medium">Active SIP Plan</span>
                            <p className="text-gray-500 dark:text-gray-400">Generate monthly recommendations automatically</p>
                        </label>
                    </div>
                </div>

                <div className="bg-gray-50 dark:bg-gray-700 px-6 py-4 flex justify-end gap-3 border-t border-gray-200 dark:border-gray-600 rounded-b-xl">
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
                        Save SIP Plan
                    </button>
                </div>
            </div>
        </div>
    );
}
