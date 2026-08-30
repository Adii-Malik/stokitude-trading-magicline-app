import { MainLayout } from './';
import { useSocketConnection } from '../../hooks/useSocketConnection';

/**
 * Layout Provider Component
 * Wraps a page in the shared chrome and keeps the socket open behind it.
 */
export default function LayoutProvider({ currentPage, showFooter, children }) {
    useSocketConnection();

    return (
        <MainLayout currentPage={currentPage} showFooter={showFooter}>
            {children}
        </MainLayout>
    );
}

