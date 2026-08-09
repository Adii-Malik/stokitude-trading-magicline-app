export const MISTAKE_LABELS = {
    no_stop_placed: 'No stop placed',
    held_through_event: 'Held through event',
    no_profit_protection: 'No profit protection',
    moved_stop_down: 'Moved stop against me',
    oversized: 'Position too large',
    fomo_entry: 'FOMO entry',
    no_thesis: 'No thesis',
    exited_early: 'Exited early'
};

export const mistakeLabel = (code) => MISTAKE_LABELS[code] || code;
