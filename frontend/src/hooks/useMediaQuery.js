import { useState, useEffect } from 'react';

/**
 * Whether a CSS media query currently matches.
 *
 * For the handful of decisions CSS cannot make on its own. Hiding a panel is a
 * class; deciding whether anything should be *selected* is state, and state has
 * to know which layout it is in.
 *
 * Kept as a query string rather than a named breakpoint so the call site says
 * which one it means, and so it stays honest against Tailwind's own values
 * instead of a second copy of them drifting here.
 */
export function useMediaQuery(query) {
    const [matches, setMatches] = useState(
        () => typeof window !== 'undefined' && window.matchMedia(query).matches
    );

    useEffect(() => {
        const mql = window.matchMedia(query);
        const onChange = (e) => setMatches(e.matches);
        setMatches(mql.matches);
        mql.addEventListener('change', onChange);
        return () => mql.removeEventListener('change', onChange);
    }, [query]);

    return matches;
}

/** Tailwind's `lg`. The width at which a list and its detail sit side by side. */
export const SPLIT_VIEW = '(min-width: 1024px)';

export default useMediaQuery;
