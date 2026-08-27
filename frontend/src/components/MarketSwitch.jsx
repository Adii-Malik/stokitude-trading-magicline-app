import { useState, useRef, useEffect } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { useMarket } from '../contexts/MarketContext';

/**
 * The market the app is in, and the only place it is chosen.
 *
 * Sits with the theme toggle rather than on a page, because it is the same kind
 * of thing: a setting the whole app is read through, not a filter belonging to
 * one screen. The journal used to carry its own PKR/USD pills, which meant two
 * places could disagree about what you were looking at.
 *
 * Renders nothing when there is only one market to be in.
 */
const FLAGS = { PK: '🇵🇰', US: '🇺🇸' };

export default function MarketSwitch({ className = '' }) {
    const { market, setMarket, available, canSwitch } = useMarket();
    const [open, setOpen] = useState(false);
    const box = useRef(null);

    useEffect(() => {
        const away = (e) => { if (box.current && !box.current.contains(e.target)) setOpen(false); };
        document.addEventListener('mousedown', away);
        return () => document.removeEventListener('mousedown', away);
    }, []);

    if (!canSwitch) return null;

    return (
        <div className={`relative ${className}`} ref={box}>
            <button
                type="button"
                onClick={() => setOpen((o) => !o)}
                aria-haspopup="listbox"
                aria-expanded={open}
                aria-label={`Market: ${market}. Change market`}
                className="flex items-center gap-1.5 px-2 py-1.5 rounded-control text-sm font-bold
                           text-ink ring-1 ring-hairline hover:ring-cyan-500 transition-colors"
            >
                <span aria-hidden="true">{FLAGS[market] || '🌐'}</span>
                {market}
                <ChevronDown className="w-3 h-3 text-ink-faint" />
            </button>

            {open && (
                <div role="listbox"
                    className="absolute right-0 z-30 mt-1 w-56 bg-surface rounded-control
                               shadow-dialog ring-1 ring-hairline overflow-hidden">
                    {available.map((m) => (
                        <button
                            key={m.code}
                            type="button"
                            role="option"
                            aria-selected={m.code === market}
                            onClick={() => { setMarket(m.code); setOpen(false); }}
                            className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-left text-sm
                                        transition-colors hover:bg-surface-muted
                                        ${m.code === market ? 'bg-surface-muted font-bold' : ''}`}
                        >
                            <span aria-hidden="true">{FLAGS[m.code] || '🌐'}</span>
                            <span className="text-ink">{m.name}</span>
                            <span className="text-xs text-ink-faint">{m.currency}</span>
                            {m.code === market && <Check className="w-4 h-4 ml-auto text-cyan-600 dark:text-cyan-400" />}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
