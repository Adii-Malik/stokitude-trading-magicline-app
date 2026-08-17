/**
 * Escapes a user-supplied string for safe use inside a regular expression.
 *
 * Without this, typing `[` or `*` into a search box builds an invalid pattern and
 * the query throws — a 500 reachable by accident, not just by malice. Patterns
 * like `(a+)+` are worse: they parse fine and then backtrack.
 */
export const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export default escapeRegex;
