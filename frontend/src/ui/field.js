/**
 * The look of a form field, written once.
 *
 * This string existed three times - in the journal modal, in SymbolInput and in
 * TagInput - and had already drifted: one of them carried text-sm, so a tag field
 * rendered smaller than the input directly above it. The design lint cannot catch
 * that, because every copy uses the right tokens; they were just separate copies.
 *
 * Variants append, never rewrite, so a symbol box stays the same field that
 * happens to uppercase.
 */
export const FIELD = 'w-full px-3 py-2 border border-hairline bg-surface text-ink ' +
    'rounded-control focus:ring-2 focus:ring-cyan-500 ' +
    'disabled:opacity-60 disabled:cursor-not-allowed';

export const FIELD_UPPER = `${FIELD} uppercase`;

/**
 * A chosen option, and an unchosen one.
 *
 * Selected is the theme accent rather than a heavier hairline: a ring that only
 * changes weight is easy to miss on a row of three, and a preset you cannot see
 * is one you re-pick by accident. This pair existed hand-written in ten files
 * and had already split into several shades of the same idea.
 */
export const CHOICE = 'px-3 py-1.5 rounded-control text-sm text-left transition-colors ' +
    'ring-1 ring-hairline text-ink-muted hover:text-ink hover:ring-cyan-500';

export const CHOICE_ON = 'px-3 py-1.5 rounded-control text-sm text-left transition-colors ' +
    'bg-cyan-500 text-white ring-1 ring-cyan-500';

/** `className={choice(isSelected)}` reads as what it is at the call site. */
export const choice = (on) => (on ? CHOICE_ON : CHOICE);
