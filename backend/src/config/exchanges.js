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

export function getExchange(code) {
    return EXCHANGES[String(code || DEFAULT_EXCHANGE).toUpperCase()] || EXCHANGES[DEFAULT_EXCHANGE];
}

export function currencyOf(code) {
    return getExchange(code).currency;
}

export default EXCHANGES;
