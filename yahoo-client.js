/* ===== YAHOO CLIENT =====
 * Fetches options chains and quotes from Yahoo Finance via CORS proxies
 * Handles errors, retries, and rate limiting
 */

const YahooClient = (function() {
    'use strict';

    // CORS proxy endpoints
    const PROXIES = {
        corsproxy: 'https://corsproxy.io/?',
        allorigins: 'https://api.allorigins.win/raw?url=',
        corsanywhere: 'https://cors-anywhere.herokuapp.com/'
    };

    let currentProxy = 'corsproxy';
    let lastRequestTime = 0;
    const MIN_REQUEST_INTERVAL = 1500; // ms between requests to avoid rate limits

    // ===== UTILITY =====

    function sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    function getProxyUrl() {
        const select = document.getElementById('proxySelect');
        if (select) currentProxy = select.value;
        return PROXIES[currentProxy] || PROXIES.corsproxy;
    }

    async function rateLimit() {
        const now = Date.now();
        const elapsed = now - lastRequestTime;
        if (elapsed < MIN_REQUEST_INTERVAL) {
            await sleep(MIN_REQUEST_INTERVAL - elapsed);
        }
        lastRequestTime = Date.now();
    }

    // ===== FETCH WITH RETRY =====

    async function fetchWithRetry(url, retries = 2) {
        for (let attempt = 0; attempt <= retries; attempt++) {
            try {
                await rateLimit();

                const proxy = getProxyUrl();
                const fullUrl = proxy + encodeURIComponent(url);

                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 15000);

                const response = await fetch(fullUrl, {
                    signal: controller.signal,
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                    }
                });

                clearTimeout(timeoutId);

                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }

                const data = await response.json();
                return data;

            } catch (err) {
                if (attempt === retries) throw err;

                // Try next proxy on failure
                const proxyKeys = Object.keys(PROXIES);
                const currentIndex = proxyKeys.indexOf(currentProxy);
                const nextIndex = (currentIndex + 1) % proxyKeys.length;
                currentProxy = proxyKeys[nextIndex];

                // Update dropdown if exists
                const select = document.getElementById('proxySelect');
                if (select) select.value = currentProxy;

                await sleep(2000 * (attempt + 1));
            }
        }
        throw new Error('All retries failed');
    }

    // ===== QUOTE =====

    async function fetchQuote(ticker) {
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=1d`;
        const data = await fetchWithRetry(url);

        if (!data.chart || !data.chart.result || data.chart.result.length === 0) {
            throw new Error('No quote data available');
        }

        const result = data.chart.result[0];
        const meta = result.meta;

        return {
            price: meta.regularMarketPrice || meta.previousClose || meta.chartPreviousClose,
            change: (meta.regularMarketPrice || meta.previousClose) - (meta.previousClose || meta.chartPreviousClose),
            changePercent: meta.regularMarketChangePercent || 0,
            symbol: meta.symbol || ticker,
            currency: meta.currency || 'USD',
            previousClose: meta.previousClose || meta.chartPreviousClose
        };
    }

    // ===== OPTIONS CHAIN =====

    async function fetchOptionsChain(ticker, date = null) {
        let url = `https://query1.finance.yahoo.com/v7/finance/options/${encodeURIComponent(ticker)}`;
        if (date) url += `?date=${date}`;

        const data = await fetchWithRetry(url);

        if (!data.optionChain || !data.optionChain.result || data.optionChain.result.length === 0) {
            throw new Error('No options data available');
        }

        return data.optionChain.result[0];
    }

    // ===== EXPirations =====

    async function fetchExpirations(ticker) {
        const chain = await fetchOptionsChain(ticker);
        return chain.expirationDates || [];
    }

    // ===== CHECK IF TICKER HAS OPTIONS =====

    async function hasOptions(ticker) {
        try {
            const chain = await fetchOptionsChain(ticker);
            return chain.expirationDates && chain.expirationDates.length > 0;
        } catch {
            return false;
        }
    }

    // ===== DEMO DATA (when Yahoo fails) =====

    function getDemoData() {
        const spot = 7394.30;
        const strikes = [];
        const baseStrike = 7200;
        const step = 15;

        for (let i = 0; i < 100; i++) {
            const strike = baseStrike + i * step;
            const dist = strike - spot;
            const absDist = Math.abs(dist);

            // Synthetic GEX data that looks realistic
            const callGEX = Math.max(0, 5000000 - absDist * 8000) * Math.exp(-absDist * absDist / 200000);
            const putGEX = -Math.max(0, 6000000 - absDist * 7000) * Math.exp(-absDist * absDist / 180000);

            // Make put wall lower and call wall higher
            const putBoost = dist < -50 ? 1.5 : 1;
            const callBoost = dist > 50 ? 1.3 : 1;

            strikes.push({
                strike: strike,
                callGEX: callGEX * callBoost * (0.8 + Math.random() * 0.4),
                putGEX: putGEX * putBoost * (0.8 + Math.random() * 0.4),
                totalGEX: (callGEX * callBoost + putGEX * putBoost) * (0.8 + Math.random() * 0.4),
                callDEX: (Math.random() - 0.3) * 500000,
                putDEX: (Math.random() - 0.7) * 500000,
                totalDEX: (Math.random() - 0.5) * 800000,
                callVanna: (Math.random() - 0.5) * 10000,
                putVanna: (Math.random() - 0.5) * 10000,
                totalVanna: (Math.random() - 0.5) * 15000,
                callCharm: (Math.random() - 0.5) * 5000,
                putCharm: (Math.random() - 0.5) * 5000,
                totalCharm: (Math.random() - 0.5) * 8000,
                callOI: Math.floor(Math.random() * 50000),
                putOI: Math.floor(Math.random() * 50000),
                totalOI: Math.floor(Math.random() * 80000),
                callVol: Math.floor(Math.random() * 10000),
                putVol: Math.floor(Math.random() * 10000),
                totalVol: Math.floor(Math.random() * 15000),
                callIV: 0.15 + Math.random() * 0.25,
                putIV: 0.18 + Math.random() * 0.30,
                avgIV: 0.20 + Math.random() * 0.20
            });
        }

        // Add cumulative
        let cumGEX = 0, cumDEX = 0;
        for (const item of strikes) {
            cumGEX += item.totalGEX;
            cumDEX += item.totalDEX;
            item.cumulativeGEX = cumGEX;
            item.cumulativeDEX = cumDEX;
            item.aggregateGEX = cumGEX + (Math.random() - 0.5) * 1000000;
            item.aggregateDEX = cumDEX + (Math.random() - 0.5) * 500000;
        }

        return {
            data: strikes,
            summary: { totalCallOI: 500000, totalPutOI: 600000, totalCallVol: 100000, totalPutVol: 120000, T: 0.01 },
            quote: { price: spot, change: -12.5, changePercent: -0.17, symbol: 'SPX', currency: 'USD', previousClose: 7406.8 },
            isDemo: true
        };
    }

    // ===== PUBLIC API =====
    return {
        fetchQuote,
        fetchOptionsChain,
        fetchExpirations,
        hasOptions,
        getDemoData,
        PROXIES
    };
})();
