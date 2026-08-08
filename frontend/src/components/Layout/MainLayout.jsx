import { useNavigate } from 'react-router-dom';
import Header from '../Header';
import Footer from './Footer';

export default function MainLayout({
    children,
    currentPage,
    isConnected,
    marketStatus,
    showFooter = true
}) {
    const navigate = useNavigate();

    return (
        <div className="min-h-screen flex flex-col bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 transition-colors duration-300">
            <Header
                isConnected={isConnected}
                currentPage={currentPage}
                marketStatus={marketStatus}
                onNavigateToDashboard={() => navigate('/dashboard')}
                onNavigateToStocks={() => navigate('/stocks')}
                onNavigateToTradeSignals={() => navigate('/trade-signals')}
                onNavigateToPortfolios={() => navigate('/portfolios')}
                onNavigateToTradingBot={() => navigate('/trading-bot')}
                onNavigateToAdmin={() => navigate('/admin')}
                onNavigateToSettings={() => navigate('/settings')}
                onNavigateToProfile={() => navigate('/profile')}
                onNavigateToLogin={() => navigate('/login')}
                onNavigateToSignup={() => navigate('/signup')}
            />
            <main className="flex-1">
                {children}
            </main>
            {showFooter && <Footer />}
        </div>
    );
}

