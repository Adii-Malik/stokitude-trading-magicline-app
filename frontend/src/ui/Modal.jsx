import { useEffect } from 'react';
import { X } from 'lucide-react';

/**
 * Every dialog in the app, built once. Hand-rolled modals each forgot
 * something different: the portfolio form had no height cap, no close button
 * and no Escape, so once it outgrew the viewport there was no way out of it.
 *
 * Header and footer stay put while the body scrolls, so the actions are
 * reachable no matter how long the form gets.
 */
export function Modal({ title, onClose, footer, size = 'md', children }) {
    useEffect(() => {
        const onKey = (e) => e.key === 'Escape' && onClose?.();
        window.addEventListener('keydown', onKey);
        // The page behind must not scroll with the dialog open.
        const prev = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            window.removeEventListener('keydown', onKey);
            document.body.style.overflow = prev;
        };
    }, [onClose]);

    return (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-start sm:items-center justify-center p-4 overflow-y-auto">
            {/* No click-to-close on the backdrop. These dialogs hold long forms,
                and one stray click beside a half-filled trade threw the whole
                thing away. Escape and the close button are deliberate; a
                misplaced click is not. */}
            <div
                role="dialog"
                aria-modal="true"
                className={`bg-surface rounded-card shadow-dialog w-full ${SIZES[size]} max-h-[90vh] flex flex-col my-auto`}
            >
                <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-hairline shrink-0">
                    <h2 className="text-lg font-bold text-ink">{title}</h2>
                    <button
                        type="button" onClick={onClose} aria-label="Close"
                        className="p-1 rounded-control text-ink-faint hover:bg-surface-muted hover:text-ink"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="overflow-y-auto px-5 py-4 flex-1">{children}</div>

                {footer && (
                    <div className="flex gap-3 px-5 py-4 border-t border-hairline shrink-0">{footer}</div>
                )}
            </div>
        </div>
    );
}

const SIZES = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' };
