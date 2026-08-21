import { useState, useRef, useEffect } from 'react';
import { X } from 'lucide-react';
import { FIELD } from './field';

/**
 * Free text that still counts.
 *
 * A closed list can only hold the reasons someone thought of in advance, and the
 * ones worth recording are the ones they would not have listed - a fixed setup
 * enum put seven of eight trades in "other". Free text alone cannot be counted
 * though: "moved stop" and "moved my stop" become two unrelated strings and
 * "how often do I do this" stops being answerable.
 *
 * So: type anything, but see what you have written before as you type. The
 * vocabulary is learned rather than guessed, and spelling converges because
 * picking is easier than retyping.
 */
export function TagInput({ value = [], onChange, suggestions = [], placeholder, single = false }) {
    // In single mode the value lives in the box itself. Showing it as a chip
    // below a full-width empty input made the field look large and the answer
    // look tiny, which is backwards.
    const [draft, setDraft] = useState(single ? (value[0] || '') : '');
    const [open, setOpen] = useState(false);
    const box = useRef(null);

    useEffect(() => {
        const away = (e) => { if (box.current && !box.current.contains(e.target)) setOpen(false); };
        document.addEventListener('mousedown', away);
        return () => document.removeEventListener('mousedown', away);
    }, []);

    const add = (raw) => {
        const tag = String(raw).trim().toLowerCase();
        // Trimmed and lowercased so the same words are one tag, not three.
        if (!tag) return;
        onChange(single ? [tag] : (value.includes(tag) ? value : [...value, tag]));
        setDraft(single ? tag : '');
        setOpen(false);
    };

    const term = draft.trim().toLowerCase();
    const matches = suggestions
        .filter((s) => (single ? s !== term : !value.includes(s)) && (!term || s.toLowerCase().includes(term)))
        .slice(0, 8);

    return (
        <div className="relative" ref={box}>
            <div className={`flex flex-wrap gap-1.5 ${value.length && !single ? 'mb-1.5' : ''}`}>
                {(single ? [] : value).map((tag) => (
                    <span key={tag}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-control
                                   bg-surface-muted text-ink text-xs">
                        {tag}
                        <button type="button" aria-label={`Remove ${tag}`}
                            onClick={() => onChange(value.filter((t) => t !== tag))}
                            className="text-ink-faint hover:text-ink">
                            <X className="w-3 h-3" />
                        </button>
                    </span>
                ))}
            </div>

            <input
                type="text"
                value={draft}
                placeholder={placeholder}
                className={FIELD}
                onChange={(e) => {
                    setDraft(e.target.value);
                    setOpen(true);
                    // One value: what is typed is the answer, no commit step.
                    if (single) onChange(e.target.value.trim() ? [e.target.value.trim().toLowerCase()] : []);
                }}
                onFocus={() => setOpen(true)}
                onKeyDown={(e) => {
                    if (e.key === 'Enter') { e.preventDefault(); if (single) setOpen(false); else add(draft); }
                    // Backspace on an empty box removes the last tag, so a mistyped
                    // one goes without reaching for the mouse.
                    else if (e.key === 'Backspace' && !single && !draft && value.length) {
                        onChange(value.slice(0, -1));
                    } else if (e.key === 'Escape') setOpen(false);
                }}
            />

            {open && matches.length > 0 && (
                <div className="absolute z-20 w-full mt-1 bg-surface rounded-control shadow-card
                                ring-1 ring-hairline max-h-52 overflow-y-auto">
                    {matches.map((s) => (
                        <button key={s} type="button" onClick={() => add(s)}
                            className="w-full text-left px-3 py-1.5 text-sm text-ink hover:bg-surface-muted">
                            {s}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}


export default TagInput;
