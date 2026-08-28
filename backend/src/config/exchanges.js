/** Exchange registry. Currency and trading rules belong to the exchange, not the portfolio. */

export const EXCHANGES = {
    PSX: {
        code: 'PSX',
        name: 'Pakistan Stock Exchange',
        currency: 'PKR',
        timezone: 'Asia/Karachi',
        priceSource: 'psx',
        fractionalShares: false
    },
    NASDAQ: {
        code: 'NASDAQ',
        name: 'Nasdaq',
        currency: 'USD',
        timezone: 'America/New_York',
        priceSource: 'tradingview',
        fractionalShares: true
    },
    NYSE: {
        code: 'NYSE',
        name: 'New York Stock Exchange',
        currency: 'USD',
        timezone: 'America/New_York',
        priceSource: 'tradingview',
        fractionalShares: true
    }
};

export const EXCHANGE_CODES = Object.keys(EXCHANGES);
export const DEFAULT_EXCHANGE = 'PSX';

/**
 * A market is what the app is scoped to at any moment.
 *
 * Pakistan and the United States share a login and nothing else - different
 * broker, different tax, different calendar, different price feed. Two
 * currencies that never meet and must never be added. Rather than every screen
 * remembering that, the app is in one market the way it is in one theme, and a
 * service is told which rather than working it out from a portfolio's currency.
 *
 * Grouped by country, not by exchange: NASDAQ and NYSE are one experience.
 */
export const MARKETS = {
    // capitalGains says whether this app knows how to tax a disposal here. PSX
    // it does - NCCPL's holding-period tiers and filer status. The US it does
    // not, and a book there is better showing no tax than a Pakistani one.
    PK: { code: 'PK', name: 'Pakistan', currency: 'PKR', exchanges: ['PSX'], capitalGains: true },
    US: { code: 'US', name: 'United States', currency: 'USD', exchanges: ['NASDAQ', 'NYSE'], capitalGains: false }
};

export const MARKET_CODES = Object.keys(MARKETS);
export const DEFAULT_MARKET = 'PK';

export function getMarket(code) {
    return MARKETS[String(code || DEFAULT_MARKET).toUpperCase()] || MARKETS[DEFAULT_MARKET];
}

/** The currency everything in this market is denominated in. */
export function currencyOfMarket(code) {
    return getMarket(code).currency;
}

/** Which market a currency belongs to. Unknown currencies fall to the default. */
export function marketOfCurrency(currency) {
    const want = String(currency || '').toUpperCase();
    return MARKET_CODES.find(code => MARKETS[code].currency === want) || DEFAULT_MARKET;
}

/** Which market an exchange trades in. */
export function marketOfExchange(exchange) {
    const want = String(exchange || DEFAULT_EXCHANGE).toUpperCase();
    return MARKET_CODES.find(code => MARKETS[code].exchanges.includes(want)) || DEFAULT_MARKET;
}

export function getExchange(code) {
    return EXCHANGES[String(code || DEFAULT_EXCHANGE).toUpperCase()] || EXCHANGES[DEFAULT_EXCHANGE];
}

export function currencyOf(code) {
    return getExchange(code).currency;
}

export default EXCHANGES;
