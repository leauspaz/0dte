/* ===== APP =====
 * Main application entry point. Wires together all modules.
 */

const App = (function() {
    'use strict';

    // ===== STATE =====
    let currentTicker = 'SPY';
    let currentExp = null;
    let expirations = [];
    let quoteData = null;
    let gexData = null;
    let levels = null;
    let isDemo = false;

    // Expose state for chart builder
    window.appState = { spotPrice: 0 };

    // ===== SEARCH TICKER =====
    async function searchTicker() {
        const input = document.getElementById('tickerInput');
        const ticker = input?.value?.toUpperCase().trim();
        if (!ticker) return;

        currentTicker = ticker;
        isDemo = false;

        ui.showLoading();
        ui.setGenerateEnabled(false);

        try {
            // Fetch quote
            quoteData = await YahooClient.fetchQuote(ticker);
            window.appState.spotPrice = quoteData.price;

            // Fetch options chain for expirations
            const chain = await YahooClient.fetchOptionsChain(ticker);
            expirations = chain.expirationDates || [];

            if (expirations.length === 0) {
                throw new Error('No options data available for this ticker. This may be a futures, crypto, or FX ticker that does not have options chains on Yahoo Finance.');
            }

            // Select first expiration
            currentExp = expirations[0];

            // Render expirations
            ui.renderExpirations(expirations, currentExp);
            ui.setGenerateEnabled(true);
            ui.updateLastUpdate();

            // Auto-generate
            await generateGEX();

        } catch (err) {
            console.error('Search error:', err);
            ui.showError(err.message, 'app.searchTicker');
            ui.hideLoading();
        }
    }

    // ===== GENERATE GEX =====
    async function generateGEX() {
        if (!currentExp) return;

        ui.showLoading();

        try {
            let chain;
            let calcResult;

            if (isDemo) {
                // Use demo data
                const demo = YahooClient.getDemoData();
                calcResult = { data: demo.data, summary: demo.summary };
                quoteData = demo.quote;
                window.appState.spotPrice = quoteData.price;
            } else {
                // Fetch options for selected expiration
                chain = await YahooClient.fetchOptionsChain(currentTicker, currentExp);

                if (!chain.options || chain.options.length === 0) {
                    throw new Error('No options data for this expiration');
                }

                // Calculate all Greeks
                calcResult = GreekEngine.calculateAllGreeks(chain, quoteData.price);
            }

            gexData = calcResult.data;

            // Find key levels
            levels = GreekEngine.findKeyLevels(gexData, quoteData.price);
            levels.spotPrice = quoteData.price;

            // Update UI
            ui.renderKeyLevels(levels);
            ui.renderPriceBar(quoteData, levels);
            ui.updateRegimeBadge(levels.isPositiveGamma);
            ui.renderGreeksPanel(levels, calcResult.summary);
            ui.renderRegimeAnalysis(levels, quoteData);
            ui.updateChartTitle(currentTicker, currentExp);
            ui.updateLastUpdate();

            // Render chart with default series
            const series = ChartBuilder.activeSeries();
            ChartBuilder.render(gexData, quoteData.price, series);

        } catch (err) {
            console.error('Generate error:', err);
            ui.showError(err.message + '<br><br>Try switching CORS proxy or clicking "Load Demo Data".', 'app.generateGEX');
        } finally {
            ui.hideLoading();
        }
    }

    // ===== LOAD DEMO DATA =====
    function loadDemo() {
        isDemo = true;
        currentTicker = 'SPX';
        document.getElementById('tickerInput').value = 'SPX';

        const demo = YahooClient.getDemoData();
        gexData = demo.data;
        quoteData = demo.quote;
        window.appState.spotPrice = quoteData.price;

        // Fake expirations
        expirations = [Math.floor(Date.now() / 1000) + 86400 * 7];
        currentExp = expirations[0];
        ui.renderExpirations(expirations, currentExp);
        ui.setGenerateEnabled(true);

        // Calculate levels from demo data
        levels = GreekEngine.findKeyLevels(gexData, quoteData.price);
        levels.spotPrice = quoteData.price;

        // Update UI
        ui.renderKeyLevels(levels);
        ui.renderPriceBar(quoteData, levels);
        ui.updateRegimeBadge(levels.isPositiveGamma);
        ui.renderGreeksPanel(levels, demo.summary);
        ui.renderRegimeAnalysis(levels, quoteData);
        ui.updateChartTitle('SPX (Demo)', currentExp);
        ui.updateLastUpdate();

        // Render chart
        const series = ChartBuilder.activeSeries();
        ChartBuilder.render(gexData, quoteData.price, series);
    }

    // ===== SET EXPIRATION =====
    function setExp(timestamp) {
        currentExp = timestamp;
    }

    // ===== REFRESH =====
    async function refresh() {
        if (!currentExp) {
            await searchTicker();
        } else {
            await generateGEX();
        }
    }

    // ===== INIT =====
    function init() {
        ui.init();

        // Load initial ticker
        searchTicker();
    }

    // ===== PUBLIC API =====
    return {
        init,
        searchTicker,
        generateGEX,
        loadDemo,
        setExp,
        refresh
    };
})();

// Expose to window for HTML onclick handlers
window.app = App;

// Start when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    App.init();
});
