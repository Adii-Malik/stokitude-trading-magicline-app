import { useState, useEffect } from 'react';
import { Calculator, AlertTriangle, Settings } from 'lucide-react';
import api from '../../services/api';
import { getRiskProfiles } from '../../services/journal';
import { sizePosition } from '../../utils/positionSizing';
import { FIELD as input } from '../../ui/field';
import { formatCurrency, formatPercent } from '../../utils/portfolioUtils';
import { BALANCED } from './presets';

/**
 * Arithmetic, and nothing else.
 *
 * The rule a book is run to used to be editable here, which meant one stored
 * value had two doors into it and neither said the other existed. The rule is
 * configuration and now lives in journal settings; this reads it and works out
 * the size. What is left is a calculator you can point at any prices you like
 * without changing anything.
 */
export default function RiskCalculator({ options, onOpenSettings }) {
    const rules = options?.exchangeRules || [{ code: 'PSX', currency: 'PKR', fractionalShares: false }];
    // Sizing is against one book, so the book is chosen, not the market. A
    // portfolio held for investing is not the capital a swing trade risks.
    const books = options?.portfolios || [];
    const [portfolioId, setPortfolioId] = useState(books[0]?._id || '');
    const [profiles, setProfiles] = useState({});
    const [trade, setTrade] = useState({ entryPrice: '', stopPrice: '', targetPrice: '' });

    const book = books.find((b) => b._id === portfolioId) || books[0];
    const currency = book?.currency || 'PKR';
    const rule = rules.find((r) => r.currency === currency) || rules[0];
    // Keyed on the book: two brokers in one currency can be run to different
    // rules, and a swing book at 5% must not put an investing book on that line.
    // Balanced stands in when a book has no rule, so the sum still answers -
    // said out loud below, because a borrowed number presented as yours is worse
    // than no number at all.
    const stored = profiles[portfolioId];
    const profile = stored || { defaultRiskPct: BALANCED.risk, maxPositionPct: BALANCED.cap };

    // Read, never entered: the portfolio already knows what it is worth.
    const [capital, setCapital] = useState(null);
    useEffect(() => {
        if (!portfolioId) { setCapital(null); return; }
        api.get('/journal/risk-context', { params: { currency, portfolioId } })
            .then((res) => setCapital(res.data.data.capital))
            .catch(() => setCapital(null));
    }, [currency, portfolioId]);

    useEffect(() => {
        getRiskProfiles()
            .then((list) => {
                const map = {};
                for (const p of list) map[p.portfolioId] = p;
                setProfiles(map);
            })
            .catch(() => setProfiles({}));
    }, []);

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
                    <Label>Book</Label>
                    <select value={portfolioId} className={input}
                        onChange={(e) => setPortfolioId(e.target.value)}>
                        {books.length === 0 && <option value="">No portfolio yet</option>}
                        {books.map((b) => (
                            <option key={b._id} value={b._id}>{b.name} · {b.currency}</option>
                        ))}
                    </select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="rounded-control bg-surface-muted px-3 py-2.5">
                        <Label>Capital</Label>
                        <p className="text-lg font-semibold text-ink tabular-nums">
                            {capital == null ? 'Pick a book' : `${currency} ${capital.toLocaleString()}`}
                        </p>
                        <p className="text-xs text-ink-faint mt-0.5">
                            {book ? `${book.name}, valued now.` : 'Choose the book this trade belongs to.'}
                        </p>
                    </div>
                    <div className="rounded-control bg-surface-muted px-3 py-2.5">
                        <Label>This book&apos;s rule</Label>
                        <p className="text-lg font-semibold text-ink tabular-nums">
                            {profile.defaultRiskPct}% risk · {profile.maxPositionPct}% max
                        </p>
                        <p className="text-xs text-ink-faint mt-0.5">
                            {stored ? 'Set in journal settings.' : 'No rule set — using Balanced for the sum below.'}
                            {onOpenSettings && (
                                <button type="button" onClick={onOpenSettings}
                                    className="ml-1 inline-flex items-center gap-1 font-semibold
                                        text-cyan-600 dark:text-cyan-400 hover:underline">
                                    <Settings className="w-3 h-3" /> {stored ? 'Change' : 'Set one'}
                                </button>
                            )}
                        </p>
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
                                Cut from {result.byRisk.toLocaleString()} shares by the {profile.maxPositionPct}% gap cap.
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
