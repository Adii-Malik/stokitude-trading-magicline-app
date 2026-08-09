/**
 * Portfolio Handler
 * Listens to price updates and emits portfolio update events
 * Follows the same pattern as tradePlanHandler
 */
import Position from '../models/Position.js';
import Stock from '../models/Stock.js';
import allocationEngineService from '../services/allocationEngineService.js';

class PortfolioHandler {
    constructor() {
        this.handlers = [];
    }

    // Register Socket.IO or other handlers
    onUpdate(handler) {
        this.handlers.push(handler);
    }

    notifyHandlers(data) {
        this.handlers.forEach(handler => handler(data));
    }

    /**
     * Check which portfolios are affected by price updates
     * Emit event for frontend to refresh
     */
    async handlePriceUpdate(updatedSymbols) {
        const currentTime = new Date().toLocaleString('en-US', { timeZone: 'Asia/Karachi' });

        try {
            if (!updatedSymbols || updatedSymbols.length === 0) {
                return { checked: 0, updated: 0 };
            }

            // Portfolios holding any of the updated symbols
            const affectedPortfolioIds = await Position.find({
                symbol: { $in: updatedSymbols },
                netShares: { $gt: 0 }
            }).distinct('portfolioId');

            if (affectedPortfolioIds.length === 0) {
                return { checked: 0, updated: 0 };
            }

            // Update unrealized P/L for affected positions
            let updated = 0;
            for (const symbol of updatedSymbols) {
                const stock = await Stock.findOne({ symbol });
                if (!stock || !stock.currentPrice) continue;

                const positions = await Position.find({
                    symbol,
                    netShares: { $gt: 0 }
                });

                for (const position of positions) {
                    // Recalculate unrealized P/L with new price
                    position.marketValue = position.netShares * stock.currentPrice;
                    position.unrealizedPnL = position.marketValue - position.costBasis;
                    position.calculatePerformanceMetrics();

                    await position.save();
                    updated++;
                }
            }

            // Emit portfolio update event
            this.notifyHandlers({
                type: 'portfolioUpdate',
                data: {
                    affectedPortfolios: affectedPortfolioIds,
                    updatedSymbols,
                    positionsUpdated: updated,
                    timestamp: new Date()
                }
            });

            // Check for drift on affected portfolios
            this.checkDriftAsync(affectedPortfolioIds);

            return {
                checked: updatedSymbols.length,
                updated,
                affectedPortfolios: affectedPortfolioIds.length
            };

        } catch (error) {
            console.error(`\n❌ [${currentTime} PKT] Portfolio handler error:`, error);
            return { checked: 0, updated: 0, error: error.message };
        }
    }

    /**
     * Check drift for portfolios asynchronously
     * Emit drift alerts if threshold exceeded
     */
    async checkDriftAsync(portfolioIds) {
        try {
            for (const portfolioId of portfolioIds) {
                const driftResult = await allocationEngineService.checkDrift(portfolioId);

                if (driftResult && driftResult.hasDrift) {
                    // Emit drift alert
                    this.notifyHandlers({
                        type: 'portfolioDriftAlert',
                        data: {
                            portfolioId,
                            drifts: driftResult.drifts,
                            checkedAt: driftResult.checkedAt
                        }
                    });
                }
            }
        } catch (error) {
            console.error('Drift check error:', error.message);
        }
    }
}

// Export singleton instance
const portfolioHandler = new PortfolioHandler();
export default portfolioHandler;
