import { MainLayout } from './';
import { useLayoutProps } from '../../hooks/useLayoutProps';

/**
 * Layout Provider Component
 * Automatically provides layout props (isConnected, marketStatus, etc.)
 * Eliminates repetitive prop passing
 */
export default function LayoutProvider({ currentPage, showFooter, children }) {
    const layoutProps = useLayoutProps();

    return (
        <MainLayout
            currentPage={currentPage}
            showFooter={showFooter}
            {...layoutProps}
        >
            {children}
        </MainLayout>
    );
}

