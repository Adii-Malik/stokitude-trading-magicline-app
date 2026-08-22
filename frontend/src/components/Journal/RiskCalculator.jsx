import { useState, useEffect } from 'react';
import { Calculator, Save, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../services/api';
import { sizePosition } from '../../utils/positionSizing';
import { formatCurrency, formatPercent } from '../../utils/portfolioUtils';

// Starting points, not stored settings. Tapping one writes the two numbers below;
// there is nothing to name, assign or keep in step with a portfolio.
const PRESETS = [
    { name: 'Conservative', risk: 1, cap: 15 },
    { name: 'Balanced', risk: 2, cap: 20 },
    { name: 'Aggressive', risk: 5, cap: 30 }
];

export default function RiskCalculator({ options }) {
    const rules = options?.exchangeRules || [{ code: 'PSX', currency: 'PKR', fractionalShares: false }];
    const [exchange, setExchange] = useState(rules[0].code);
    const [profiles, setProfiles] = useState({});
    const [trade, setTrade] = useState({ entryPrice: '', stopPrice: '', targetPrice: '' });
    const [saving, setSaving] = useState(false);

    const rule = rules.find((r) => r.code === exchange) || rules[0];
    const currency = rule.currency;
    const profile = profiles[currency] || { defaultRiskPct: 1, maxPositionPct: 25 };

    // Read, never entered: the portfolios already know what they are worth.
    const [capital, setCapital] = useState(null);
    useEffect(() => {
        api.get('/journal/risk-context', { params: { currency } })
            .then((res) => setCapital(res.data.data.capital))
            .catch(() => setCapital(null));
    }, [currency]);

    useEffect(() => {
        api.get('/journal/risk-profiles')
            .then((res) => {
                const map = {};
                for (const p of res.data.data) map[p.currency] = p;
                setProfiles(map);
            })
            .catch(() => setProfiles({}));
    }, []);

    const setProfile = (patch) =>
        setProfiles((p) => ({ ...p, [currency]: { ...profile, ...patch } }));

    const saveProfile = async () => {
        setSaving(true);
        try {
            await api.put(`/journal/risk-profiles/${currency}`, {
                defaultRiskPct: parseFloat(profile.defaultRiskPct),
                maxPositionPct: parseFloat(profile.maxPositionPct)
            });
            toast.success(`${currency} capital saved`);
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to save');
        } finally {
            setSaving(false);
        }
    };

    const result = sizePosition({
        capital,
        riskPct: parseFloat(profile.defaultRiskPct),
        entryPrice: parseFloat(trade.entryPrice),
        stopPrice: parseFloat(trade.stopPrice),
        targetPrice: trade.targetPrice ? parseFloat(trade.targetPrice) : undefined,
        maxPositionPct: parseFloat(profile.maxPositionPct),
        fractionalShares: rule.fractionalShares
    });

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-surface rounded-card p-5 shadow-card ring-1 ring-hairline space-y-4">
                <h3 className="font-semibold text-ink flex items-center gap-2">
                    <Calculator className="w-5 h-5 text-cyan-500" /> Size a trade
                </h3>

                <div>
                    <Label>Market</Label>
                    <div className="flex gap-2">
                        {rules.map((r) => (
                            <button key={r.code} type="button" onClick={() => setExchange(r.code)}
                                className={`px-3 py-1.5 rounded-lg text-sm font-medium ${exchange === r.code
                                    ? 'bg-cyan-500 text-white'
                                    : 'border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300'}`}>
                                {r.code}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="flex flex-wrap gap-2 mb-3">
                    {PRESETS.map((preset) => (
                        <button key={preset.name} type="button"
                            onClick={() => setProfile({ defaultRiskPct: preset.risk, maxPositionPct: preset.cap })}
                            className="px-3 py-1.5 rounded-control ring-1 ring-hairline text-sm
                                       text-ink-muted hover:text-ink hover:ring-cyan-500">
                            {preset.name}
                            <span className="block text-xs text-ink-faint">
                                {preset.risk}% risk · {preset.cap}% cap
                            </span>
                        </button>
                    ))}
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    <div className="col-span-2 sm:col-span-3 rounded-control bg-surface-muted px-3 py-2">
                        <Label>Capital</Label>
                        <p className="text-lg font-semibold text-ink tabular-nums">
                            {capital == null
                                ? `No ${currency} portfolio yet`
                                : `${currency} ${capital.toLocaleString()}`}
                        </p>
                        <p className="text-xs text-ink-faint mt-0.5">
                            Your {currency} portfolios, valued now. Typed once, it would be
                            wrong by the time the account moved.
                        </p>
                    </div>
                    <div>
                        <Label>Risk per trade</Label>
                        <div className="relative">
                            <input type="number" step="any" className={input} value={profile.defaultRiskPct}
                                onChange={(e) => setProfile({ defaultRiskPct: e.target.value })} />
                            <span className="absolute right-3 top-2 text-ink-faint text-sm">%</span>
                        </div>
                    </div>
                    <div>
                        <Label>Gap cap</Label>
                        <div className="relative">
                            <input type="number" step="any" className={input} value={profile.maxPositionPct}
                                onChange={(e) => setProfile({ maxPositionPct: e.target.value })} />
                            <span className="absolute right-3 top-2 text-ink-faint text-sm">%</span>
                        </div>
                    </div>
                    <p className="col-span-2 sm:col-span-3 text-xs text-gray-500 dark:text-gray-400">
                        Risk per trade is what you lose when the stop works. The gap cap limits the
                        position itself, for when price jumps straight past it — 20–25% is sensible.
                    </p>
                    <div className="flex items-end">
                        <button type="button" onClick={saveProfile} disabled={saving}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center justify-center gap-1 disabled:opacity-50">
                            <Save className="w-4 h-4" /> Save
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 border-t border-gray-200 dark:border-gray-700 pt-4">
                    <div>
                        <Label>Entry</Label>
                        <input type="number" step="any" className={input} value={trade.entryPrice}
                            onChange={(e) => setTrade({ ...trade, entryPrice: e.target.value })} />
                    </div>
                    <div>
                        <Label>Stop</Label>
                        <input type="number" step="any" className={input} value={trade.stopPrice}
                            onChange={(e) => setTrade({ ...trade, stopPrice: e.target.value })} />
                    </div>
                    <div>
                        <Label>Target</Label>
                        <input type="number" step="any" className={input} value={trade.targetPrice}
                            placeholder="optional"
                            onChange={(e) => setTrade({ ...trade, targetPrice: e.target.value })} />
                    </div>
                </div>
            </div>

            <div className="bg-surface rounded-card p-5 shadow-card ring-1 ring-hairline">
                {!result ? (
                    <p className="text-sm text-ink-faint">
                        Enter your capital, an entry and a stop. Size follows from the stop.
                    </p>
                ) : result.error ? (
                    <div className="flex gap-2 text-amber-600 dark:text-amber-400">
                        <AlertTriangle className="w-5 h-5 shrink-0" />
                        <span className="text-sm">{result.error}</span>
                    </div>
                ) : (
                    <div className="space-y-4">
                        <div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">Buy</div>
                            <div className="text-3xl font-bold text-gray-900 dark:text-white">
                                {result.shares.toLocaleString()} <span className="text-lg font-normal">shares</span>
                            </div>
                            <div className="text-sm text-gray-600 dark:text-gray-400">
                                {formatCurrency(result.positionValue, currency)} · {formatPercent(result.positionPct, 1)} of the account
                            </div>
                        </div>

                        {result.cappedBy && (
                            <p className="text-xs text-amber-600 dark:text-amber-400">
                                Cut from {result.byRisk.toLocaleString()} shares by your {profile.maxPositionPct}% gap cap.
                                The stop is tight enough that a gap through it would hurt far more than the planned risk.
                            </p>
                        )}

                        <div className="grid grid-cols-2 gap-3 border-t border-gray-200 dark:border-gray-700 pt-4">
                            <Out label="If the stop hits" value={formatCurrency(-result.actualRisk, currency)}
                                sub={formatPercent(result.actualRiskPct, 2) + ' of capital'} tone="red" />
                            <Out label="Risk per share" value={formatCurrency(result.riskPerShare, currency)} />
                            {result.reward != null && (
                                <>
                                    <Out label="If the target hits" value={formatCurrency(result.reward, currency)} tone="green" />
                                    <Out label="Reward : risk" value={`${result.rr.toFixed(2)} : 1`}
                                        sub={result.rr < 1.5 ? 'thin for the risk' : ''} />
                                </>
                            )}
                        </div>

                        <p className="text-xs text-gray-500 dark:text-gray-400 border-t border-gray-200 dark:border-gray-700 pt-3">
                            Place the stop at {trade.stopPrice} as a resting order, not a mental note.
                            {!rule.fractionalShares && ' Rounded down to whole shares.'}
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}

const input = 'w-full px-3 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-cyan-500';

function Label({ children }) {
    return <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{children}</label>;
}

function Out({ label, value, sub, tone }) {
    const tones = { red: 'text-red-600 dark:text-red-400', green: 'text-green-600 dark:text-green-400' };
    return (
        <div>
            <div className="text-xs text-gray-500 dark:text-gray-400">{label}</div>
            <div className={`text-lg font-semibold ${tones[tone] || 'text-gray-900 dark:text-white'}`}>{value}</div>
            {sub && <div className="text-xs text-gray-500 dark:text-gray-400">{sub}</div>}
        </div>
    );
}
