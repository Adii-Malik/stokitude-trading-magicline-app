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
export function TagInput({
    value = [], onChange, suggestions = [], placeholder, single = false,
    // Optional: 'good' | 'bad' | null per tag, so a word can show how it is being
    // read rather than the reading happening silently somewhere else.
    toneOf
}) {
    const [draft, setDraft] = useState('');
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
        setDraft('');
        setOpen(false);
    };

    const term = draft.trim().toLowerCase();
    const matches = suggestions
        .filter((s) => !value.includes(s) && (!term || s.toLowerCase().includes(term)))
        .slice(0, 8);

    return (
        <div className="relative" ref={box}>
            <div className={`flex flex-wrap gap-1.5 ${value.length ? 'mb-1.5' : ''}`}>
                {value.map((tag) => (
                    <span key={tag} className={`inline-flex items-center gap-2 px-3 py-1.5
                                    rounded-control text-sm ring-1 ${TONE[toneOf?.(tag)] || TONE.plain}`}>
                        {tag}
                        <button type="button" aria-label={`Remove ${tag}`}
                            onClick={() => onChange(value.filter((t) => t !== tag))}
                            className="opacity-60 hover:opacity-100">
                            <X className="w-3.5 h-3.5" />
                        </button>
                    </span>
                ))}
            </div>

            <input
                type="text"
                value={draft}
                placeholder={single && value.length ? 'Replace it…' : placeholder}
                className={FIELD}
                onChange={(e) => { setDraft(e.target.value); setOpen(true); }}
                onFocus={() => setOpen(true)}
                onBlur={() => add(draft)}
                onKeyDown={(e) => {
                    if (e.key === 'Enter') { e.preventDefault(); add(draft); }
                    // Backspace on an empty box removes the last tag, so a mistyped
                    // one goes without reaching for the mouse.
                    else if (e.key === 'Backspace' && !draft && value.length) {
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


const TONE = {
    plain: 'bg-surface-muted text-ink ring-hairline',
    good: 'bg-green-50 dark:bg-green-950/40 text-green-700 dark:text-green-300 ring-green-600/30',
    bad: 'bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 ring-red-500/30'
};

export default TagInput;
