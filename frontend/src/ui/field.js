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
