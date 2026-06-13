/* ===== APP =====
 * 0DTE GEX Analyzer — connects to local Python backend
 */

const App = (function() {
    'use strict';

    let currentTicker = 'SPY';
    let currentExp = null;
    let expirations = [];
    let quoteData = null;
    let gexData = null;
    let levels = null;

    window.appState = { spotPrice: 0, activeSeries: 'gex' };

    function init() {
        if (window.ui && window.ui.init) window.ui.init();
        searchTicker();
    }

    async function searchTicker() {
        const input = document.getElementById('tickerInput');
        const ticker = input?.value?.toUpperCase().trim();
        if (!ticker) return;

        currentTicker = ticker;
        ui.showLoading();
        ui.setGenerateEnabled(false);

        try {
            quoteData = await APIClient.getQuote(ticker);
            window.appState.spotPrice = quoteData.price;

            const expData = await APIClient.getExpirations(ticker);
            expirations = expData.expirations || [];

            if (expirations.length === 0) {
                throw new Error('No options expirations found for this ticker.');
            }

            currentExp = expirations[0];
            ui.renderExpirations(expirations, currentExp);
            ui.setGenerateEnabled(true);
            ui.updateLastUpdate();

            await generateGEX();

        } catch (err) {
            console.error('Search error:', err);
            ui.showError(err.message + '<br><br>Make sure the Python server is running (python main.py)');
            ui.hideLoading();
        }
    }

    async function generateGEX() {
        if (!currentExp) return;
        ui.showLoading();

        try {
            const result = await APIClient.getGEX(currentTicker, currentExp);

            gexData = result.data;
            levels = result.levels;
            levels.spot_price = result.quote.price;
            quoteData = result.quote;

            // Pass levels to chart builder for annotations
            if (window.chart && window.chart.setLevels) {
                window.chart.setLevels(levels);
            }

            renderAll(result.summary);

        } catch (err) {
            console.error('Generate error:', err);
            ui.showError(err.message);
        } finally {
            ui.hideLoading();
        }
    }

    function renderAll(summary) {
        ui.renderKeyLevels(levels);
        ui.renderPriceBar(quoteData, levels);
        ui.updateRegimeBadge(levels.is_positive_gamma);
        ui.renderGreeksPanel(levels, summary);
        ui.renderRegimeAnalysis(levels, quoteData);
        ui.updateChartTitle(currentTicker, currentExp);
        ui.updateLastUpdate();

        // Use single-series mode from chart builder
        const series = window.chart ? window.chart.activeSeries() : 'gex';
        if (window.chart && window.chart.render) {
            window.chart.render(gexData, quoteData.price, series);
        }
    }

    function setExp(timestamp) {
        currentExp = timestamp;
    }

    async function refresh() {
        if (currentExp) {
            await generateGEX();
        } else {
            await searchTicker();
        }
    }

    return {
        init,
        searchTicker,
        generateGEX,
        setExp,
        refresh
    };
})();

window.app = App;

document.addEventListener('DOMContentLoaded', () => {
    App.init();
});
