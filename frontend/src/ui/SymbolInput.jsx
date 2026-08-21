import { useState, useEffect, useRef } from 'react';
import { searchStocks } from '../services/stocks';
import { FIELD_UPPER } from './field';

/**
 * The symbol field, built once.
 *
 * Typing a ticker from memory is how the wrong symbol gets journalled, so every
 * place that asks for one suggests from the stocks this app already knows. It was
 * previously hand-rolled twice in the portfolio modals and not at all in the
 * journal, which is the sort of gap a class-based lint rule cannot see.
 *
 * Adds what both copies lacked: a debounce, so a five-letter ticker is one request
 * rather than five, and keyboard navigation, so the list is usable without a mouse.
 */
export function SymbolInput({
    value, onChange, onSelect, disabled, required, placeholder = 'e.g. OGDC', className
}) {
    const [matches, setMatches] = useState([]);
    const [open, setOpen] = useState(false);
    const [active, setActive] = useState(-1);
    const box = useRef(null);
    // Guards against a slow early request landing after a later one.
    const latest = useRef(0);

    useEffect(() => {
        const term = (value || '').trim();
        if (!term || !open) return;

        const id = ++latest.current;
        const t = setTimeout(async () => {
            try {
                const res = await searchStocks(term);
                if (id !== latest.current) return;
                setMatches(res.data || []);
                setActive(-1);
            } catch {
                // A failed lookup must not block typing a symbol by hand.
                setMatches([]);
            }
        }, 200);

        return () => clearTimeout(t);
    }, [value, open]);

    // Clicking away closes the list without choosing anything.
    useEffect(() => {
        const away = (e) => { if (box.current && !box.current.contains(e.target)) setOpen(false); };
        document.addEventListener('mousedown', away);
        return () => document.removeEventListener('mousedown', away);
    }, []);

    const choose = (stock) => {
        onChange(stock.symbol);
        onSelect?.(stock);
        setOpen(false);
        setMatches([]);
    };

    const onKeyDown = (e) => {
        if (!open || !matches.length) return;
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setActive((i) => (i + 1) % matches.length);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActive((i) => (i <= 0 ? matches.length - 1 : i - 1));
        } else if (e.key === 'Enter' && active >= 0) {
            // Only steals Enter when something is highlighted, so the form can
            // still be submitted from this field.
            e.preventDefault();
            choose(matches[active]);
        } else if (e.key === 'Escape') {
            setOpen(false);
        }
    };

    return (
        <div className="relative" ref={box}>
            <input
                type="text"
                value={value || ''}
                required={required}
                disabled={disabled}
                placeholder={placeholder}
                autoComplete="off"
                className={className || FIELD_UPPER}
                onChange={(e) => { onChange(e.target.value.toUpperCase()); setOpen(true); }}
                onFocus={() => setOpen(true)}
                onKeyDown={onKeyDown}
            />

            {open && matches.length > 0 && (
                <div className="absolute z-20 w-full mt-1 bg-surface rounded-control shadow-card
                                ring-1 ring-hairline max-h-60 overflow-y-auto">
                    {matches.map((stock, i) => (
                        <button
                            key={stock._id || stock.symbol}
                            type="button"
                            onMouseEnter={() => setActive(i)}
                            onClick={() => choose(stock)}
                            className={`w-full text-left px-3 py-2 transition-colors
                                        ${i === active ? 'bg-surface-muted' : ''}`}
                        >
                            <span className="font-semibold text-cyan-600 dark:text-cyan-400">{stock.symbol}</span>
                            {stock.currentPrice > 0 && (
                                <span className="float-right text-sm text-ink-muted tabular-nums">
                                    {stock.currentPrice}
                                </span>
                            )}
                            {stock.companyName && (
                                <span className="block text-xs text-ink-faint truncate">{stock.companyName}</span>
                            )}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}


export default SymbolInput;
