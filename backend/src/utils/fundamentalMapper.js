/**
 * Fundamental Data Mapper
 * Maps Python core service fields to scoring engine format
 * Decouples data source from scoring logic
 */

/**
 * Map Python core fundamental data to scoring engine format
 * @param {Object} pythonData - Raw data from Python core service
 * @returns {Object} Mapped data with scoring engine field names
 */
export function mapPythonFundamentals(pythonData) {
    if (!pythonData) return {};

    return {
        // Basic Info
        symbol: pythonData.symbol,
        sector: pythonData.sector,

        // Dividend Metrics
        dividendYield: pythonData.dividend_yield_recent || 0,
        dividendTTM: pythonData.total_cash_dividends_paid_ttm || 0,
        payoutRatio: pythonData.dividend_payout_ratio_ttm || 0,
        dividendConsistencyYears: pythonData.continuous_dividend_growth || 0,

        // Cash Flow Coverage (KEY for dividend safety)
        cash_dividend_coverage_ratio_ttm: pythonData.cash_dividend_coverage_ratio_ttm || 0,

        // Growth Metrics
        total_revenue_cagr_5y: pythonData.total_revenue_cagr_5y || 0,
        earnings_per_share_diluted_yoy_growth_ttm: pythonData.earnings_per_share_diluted_yoy_growth_ttm || 0,
        epsGrowth3Y: pythonData.earnings_per_share_diluted_yoy_growth_ttm || 0, // Fallback to YoY
        revenueGrowth3Y: pythonData.total_revenue_cagr_5y || 0, // Use 5Y CAGR

        // Quality Metrics
        roe: pythonData.return_on_equity || 0,
        debtToEquity: pythonData.debt_to_equity || 0,
        currentRatio: pythonData.current_ratio || 1,

        // Valuation
        pe: pythonData.price_earnings_ttm || 0,
        pb: pythonData.price_book_ratio || 0,

        // Historical Arrays (for advanced analysis)
        dpsHistory: pythonData.dps_common_stock_prim_issue_fy_h || [],
        epsHistory: pythonData.earnings_per_share_diluted_fy_h || [],
        revenueHistory: pythonData.total_revenue_fy_h || [],
        fcfHistory: pythonData.free_cash_flow_fy_h || [],
        assetsHistory: pythonData.total_assets_fy_h || [],

        // Additional Quality
        interestCoverage: pythonData.ebitda_interst_cover_ttm || 0,
        freeCashFlow: pythonData.free_cash_flow || 0,
        operatingCashFlow: pythonData.cash_f_operating_activities_ttm || 0,

        // Shariah (Python API returns is_shariah_compliant, not shariah_compliant)
        shariahCompliant: pythonData.is_shariah_compliant ?? pythonData.shariah_compliant ?? false
    };
}

/**
 * Calculate dividend volatility from historical DPS
 * @param {Array} dpsHistory - Array of historical DPS values
 * @returns {Number} Standard deviation of DPS changes (0-100 scale)
 */
export function calculateDividendVolatility(dpsHistory) {
    if (!dpsHistory || dpsHistory.length < 3) return 50; // Neutral if insufficient data

    // Calculate year-over-year changes
    const changes = [];
    for (let i = 1; i < dpsHistory.length; i++) {
        if (dpsHistory[i - 1] > 0) {
            const change = ((dpsHistory[i] - dpsHistory[i - 1]) / dpsHistory[i - 1]) * 100;
            changes.push(change);
        }
    }

    if (changes.length === 0) return 50;

    // Calculate standard deviation
    const mean = changes.reduce((sum, val) => sum + val, 0) / changes.length;
    const variance = changes.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / changes.length;
    const stdDev = Math.sqrt(variance);

    // Score: Lower volatility = better
    // 0% volatility = 100, 20%+ volatility = 0
    if (stdDev <= 0) return 100;
    if (stdDev >= 20) return 0;

    return 100 - ((stdDev / 20) * 100);
}

/**
 * Calculate earnings stability from historical EPS
 * @param {Array} epsHistory - Array of historical EPS values
 * @returns {Number} Stability score (0-100)
 */
export function calculateEarningsStability(epsHistory) {
    if (!epsHistory || epsHistory.length < 3) return 50;

    // Calculate year-over-year growth rates
    const growthRates = [];
    for (let i = 1; i < epsHistory.length; i++) {
        if (epsHistory[i - 1] !== 0) {
            const growth = ((epsHistory[i] - epsHistory[i - 1]) / Math.abs(epsHistory[i - 1])) * 100;
            growthRates.push(growth);
        }
    }

    if (growthRates.length === 0) return 50;

    // Calculate coefficient of variation
    const mean = growthRates.reduce((sum, val) => sum + val, 0) / growthRates.length;
    const variance = growthRates.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / growthRates.length;
    const stdDev = Math.sqrt(variance);
    const cv = mean !== 0 ? Math.abs(stdDev / mean) : 999;

    // Score: Lower CV = more stable
    // CV < 0.5 = excellent, CV > 2.0 = poor
    if (cv <= 0.5) return 100;
    if (cv >= 2.0) return 0;

    return 100 - (((cv - 0.5) / 1.5) * 100);
}

/**
 * Enrich mapped data with calculated metrics
 * @param {Object} mappedData - Data from mapPythonFundamentals
 * @returns {Object} Enriched data with calculated metrics
 */
export function enrichFundamentals(mappedData) {
    return {
        ...mappedData,
        dividendVolatility: calculateDividendVolatility(mappedData.dpsHistory),
        earningsStability: calculateEarningsStability(mappedData.epsHistory)
    };
}

export default {
    mapPythonFundamentals,
    calculateDividendVolatility,
    calculateEarningsStability,
    enrichFundamentals
};
