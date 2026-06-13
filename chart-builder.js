/* ===== CHART BUILDER =====
 * Horizontal GEX chart — single axis, hardcoded colors
 * Restored from working version + annotation v3 syntax fixes
 */

const ChartBuilder = (function() {
    'use strict';

    let chartInstance = null;
    let currentData = null;
    let currentLevels = null;
    let currentSpot = 0;
    let activeSeries = 'gex';

    let showAggregate = true;
    let showNet = true;
    let showSplit = false;
    let showCallWall = true;
    let showPutWall = true;
    let showInflection = true;
    let showZeroGamma = false;
    let showSpot = true;

    const COLORS = {
        call: 'hsla(142, 71%, 45%, 0.65)',
        callBorder: 'hsla(142, 71%, 45%, 0.90)',
        put: 'hsla(0, 72%, 51%, 0.65)',
        putBorder: 'hsla(0, 72%, 51%, 0.90)',
        aggregate: 'hsla(262, 83%, 58%, 0.95)',
        aggregateFill: 'hsla(262, 83%, 58%, 0.08)',
        net: 'hsla(38, 92%, 50%, 0.95)',
        netFill: 'hsla(38, 92%, 50%, 0.06)',
        dex: 'hsla(217, 91%, 60%, 0.95)',
        dexFill: 'hsla(217, 91%, 60%, 0.08)',
        vanna: 'hsla(25, 95%, 53%, 0.95)',
        vannaFill: 'hsla(25, 95%, 53%, 0.08)',
        charm: 'hsla(199, 89%, 48%, 0.95)',
        charmFill: 'hsla(199, 89%, 48%, 0.08)',
        oi: 'hsla(0, 0%, 60%, 0.80)',
        iv: 'hsla(330, 81%, 60%, 0.95)',
        grid: 'hsla(0, 0%, 100%, 0.06)',
        text: 'hsla(0, 0%, 55%, 1)',
        callWall: 'hsla(142, 71%, 45%, 0.80)',
        putWall: 'hsla(0, 72%, 51%, 0.80)',
        inflection: 'hsla(262, 83%, 58%, 0.80)',
        zeroGamma: 'hsla(262, 83%, 58%, 0.80)',
        spot: 'hsla(217, 91%, 60%, 0.80)'
    };

    function fmt(v) {
        const a = Math.abs(v);
        if (a >= 1e9) return (v / 1e9).toFixed(2) + 'B';
        if (a >= 1e6) return (v / 1e6).toFixed(2) + 'M';
        if (a >= 1e3) return (v / 1e3).toFixed(1) + 'K';
        return v.toFixed(0);
    }

    function get(d, camel, snake) {
        return d[camel] !== undefined ? d[camel] : (d[snake] !== undefined ? d[snake] : 0);
    }

    function smooth(data, ws) {
        if (!ws || ws < 2) return data;
        const res = [];
        for (let i = 0; i < data.length; i++) {
            let sum = 0, cnt = 0;
            const h = Math.floor(ws / 2);
            for (let j = Math.max(0, i - h); j <= Math.min(data.length - 1, i + h); j++) {
                sum += data[j]; cnt++;
            }
            res.push(sum / cnt);
        }
        return res;
    }

    function buildDatasets(data, spotPrice, series) {
        const datasets = [];
        const range = 0.12;
        const minS = spotPrice * (1 - range);
        const maxS = spotPrice * (1 + range);
        const filtered = data.filter(d => d.strike >= minS && d.strike <= maxS);
        const labels = filtered.map(d => d.strike.toFixed(1));
        const sw = parseInt(localStorage.getItem('gex-smoothing') || '7');

        const addBar = (label, arr, bg, border) => {
            datasets.push({
                label, data: arr,
                backgroundColor: bg, borderColor: border, borderWidth: 1,
                type: 'bar', xAxisID: 'x',
                barPercentage: 0.85, categoryPercentage: 0.95,
                indexAxis: 'y', order: 2
            });
        };

        const addLine = (label, arr, color, thick) => {
            datasets.push({
                label, data: arr,
                borderColor: color, backgroundColor: 'transparent',
                borderWidth: thick ? 2.5 : 2,
                type: 'line', xAxisID: 'x',
                tension: 0.4, pointRadius: 0, pointHoverRadius: 4,
                fill: false, indexAxis: 'y', order: 0
            });
        };

        if (series === 'gex') {
            if (showSplit) {
                addBar('Put GEX', filtered.map(d => get(d, 'putGEX', 'put_gex')), COLORS.put, COLORS.putBorder);
                addBar('Call GEX', filtered.map(d => get(d, 'callGEX', 'call_gex')), COLORS.call, COLORS.callBorder);
            } else {
                addBar('Net GEX', filtered.map(d => get(d, 'totalGEX', 'total_gex')),
                    (ctx) => { const v = ctx.raw; return v >= 0 ? COLORS.call : COLORS.put; },
                    (ctx) => { const v = ctx.raw; return v >= 0 ? COLORS.callBorder : COLORS.putBorder; });
            }
            if (showAggregate) addLine('Aggregate GEX', smooth(filtered.map(d => get(d, 'aggregateGEX', 'aggregate_gex')), sw), COLORS.aggregate);
            if (showNet) addLine('Cumulative GEX', smooth(filtered.map(d => get(d, 'cumulativeGEX', 'cumulative_gex')), sw), COLORS.net, true);
        }

        if (series === 'dex') {
            if (showSplit) {
                addBar('Put DEX', filtered.map(d => get(d, 'putDEX', 'put_dex')), 'hsla(0, 72%, 51%, 0.40)', 'hsla(0, 72%, 51%, 0.60)');
                addBar('Call DEX', filtered.map(d => get(d, 'callDEX', 'call_dex')), 'hsla(142, 71%, 45%, 0.40)', 'hsla(142, 71%, 45%, 0.60)');
            } else {
                addBar('Net DEX', filtered.map(d => get(d, 'totalDEX', 'total_dex')),
                    (ctx) => { const v = ctx.raw; return v >= 0 ? 'hsla(142, 71%, 45%, 0.45)' : 'hsla(0, 72%, 51%, 0.45)'; },
                    (ctx) => { const v = ctx.raw; return v >= 0 ? 'hsla(142, 71%, 45%, 0.65)' : 'hsla(0, 72%, 51%, 0.65)'; });
            }
            if (showNet) addLine('Cumulative DEX', smooth(filtered.map(d => get(d, 'cumulativeDEX', 'cumulative_dex')), sw), COLORS.dex, true);
        }

        if (series === 'vanna') {
            if (showSplit) {
                addBar('Put Vanna', filtered.map(d => get(d, 'putVanna', 'put_vanna')), 'hsla(0, 72%, 51%, 0.35)', 'hsla(0, 72%, 51%, 0.50)');
                addBar('Call Vanna', filtered.map(d => get(d, 'callVanna', 'call_vanna')), 'hsla(142, 71%, 45%, 0.35)', 'hsla(142, 71%, 45%, 0.50)');
            } else {
                addBar('Net Vanna', filtered.map(d => get(d, 'totalVanna', 'total_vanna')), 'hsla(25, 95%, 53%, 0.30)', 'hsla(25, 95%, 53%, 0.90)');
            }
            if (showNet) addLine('Cumulative Vanna', smooth(filtered.map(d => get(d, 'totalVanna', 'total_vanna')), sw), COLORS.vanna, true);
        }

        if (series === 'charm') {
            if (showSplit) {
                addBar('Put Charm', filtered.map(d => get(d, 'putCharm', 'put_charm')), 'hsla(0, 72%, 51%, 0.35)', 'hsla(0, 72%, 51%, 0.50)');
                addBar('Call Charm', filtered.map(d => get(d, 'callCharm', 'call_charm')), 'hsla(142, 71%, 45%, 0.35)', 'hsla(142, 71%, 45%, 0.50)');
            } else {
                addBar('Net Charm', filtered.map(d => get(d, 'totalCharm', 'total_charm')), 'hsla(199, 89%, 48%, 0.30)', 'hsla(199, 89%, 48%, 0.90)');
            }
            if (showNet) addLine('Cumulative Charm', smooth(filtered.map(d => get(d, 'totalCharm', 'total_charm')), sw), COLORS.charm, true);
        }

        if (series === 'oi') {
            addBar('Call OI', filtered.map(d => get(d, 'callOI', 'call_oi')), 'hsla(142, 71%, 45%, 0.45)', 'hsla(142, 71%, 45%, 0.65)');
            addBar('Put OI', filtered.map(d => get(d, 'putOI', 'put_oi')), 'hsla(0, 72%, 51%, 0.45)', 'hsla(0, 72%, 51%, 0.65)');
            if (showNet) addLine('Total OI', smooth(filtered.map(d => get(d, 'totalOI', 'total_oi')), sw), COLORS.oi);
        }

        if (series === 'iv') {
            datasets.push({
                label: 'Call IV', data: filtered.map(d => get(d, 'callIV', 'call_iv') * 100),
                borderColor: 'hsla(330, 81%, 60%, 0.95)', backgroundColor: 'transparent',
                borderWidth: 1.5, type: 'line', xAxisID: 'x',
                tension: 0.4, pointRadius: 0, pointHoverRadius: 4,
                fill: false, indexAxis: 'y', order: 0
            });
            datasets.push({
                label: 'Put IV', data: filtered.map(d => get(d, 'putIV', 'put_iv') * 100),
                borderColor: 'hsla(199, 89%, 48%, 0.95)', backgroundColor: 'transparent',
                borderWidth: 1.5, type: 'line', xAxisID: 'x',
                tension: 0.4, pointRadius: 0, pointHoverRadius: 4,
                fill: false, indexAxis: 'y', order: 1
            });
            if (showNet) {
                datasets.push({
                    label: 'IV Skew', data: smooth(filtered.map(d => (get(d, 'putIV', 'put_iv') - get(d, 'callIV', 'call_iv')) * 100), sw),
                    borderColor: COLORS.net, backgroundColor: 'transparent',
                    borderWidth: 1.5, type: 'line', xAxisID: 'x',
                    tension: 0.4, pointRadius: 0, pointHoverRadius: 4,
                    borderDash: [5, 5], fill: false, indexAxis: 'y', order: 2
                });
            }
        }

        return { datasets, labels, filtered };
    }

    function buildAnnotations(filtered, levels, spotPrice) {
        const ann = {};

        const findIdx = (target) => {
            let best = 0, diff = Infinity;
            for (let i = 0; i < filtered.length; i++) {
                const d = Math.abs(filtered[i].strike - target);
                if (d < diff) { diff = d; best = i; }
            }
            return best;
        };

        const mkLine = (id, strike, color, text, isSpot) => {
            const idx = findIdx(strike);
            ann[id] = {
                type: 'line',
                yMin: idx, yMax: idx,
                xScaleID: 'x', yScaleID: 'y',
                borderColor: color,
                borderWidth: isSpot ? 2.5 : 2,
                borderDash: isSpot ? [8, 4] : [6, 3],
                label: {
                    display: true,
                    content: text,
                    position: isSpot ? 'start' : 'end',
                    backgroundColor: 'rgba(10, 10, 10, 0.90)',
                    color: color,
                    font: { size: 10, family: "'JetBrains Mono', monospace", weight: '600' },
                    padding: { x: 8, y: 3 },
                    borderRadius: 4,
                    borderWidth: 1,
                    borderColor: color
                }
            };
        };

        if (showSpot && spotPrice > 0) {
            mkLine('spotLine', spotPrice, COLORS.spot, 'Spot: $' + spotPrice.toFixed(2), true);
        }
        if (showCallWall && levels) {
            const cw = levels.call_wall !== undefined ? levels.call_wall : levels.callWall;
            if (cw > 0) mkLine('callWallLine', cw, COLORS.callWall, 'Call Wall: $' + cw.toFixed(1));
        }
        if (showPutWall && levels) {
            const pw = levels.put_wall !== undefined ? levels.put_wall : levels.putWall;
            if (pw > 0) mkLine('putWallLine', pw, COLORS.putWall, 'Put Wall: $' + pw.toFixed(1));
        }
        if (showInflection && levels) {
            const inf = levels.inflection !== undefined ? levels.inflection : levels.inflection;
            if (inf > 0) mkLine('inflectionLine', inf, COLORS.inflection, 'Inflection: $' + inf.toFixed(1));
        }
        if (showZeroGamma && levels) {
            const zg = levels.zero_gamma !== undefined ? levels.zero_gamma : levels.zeroGamma;
            if (zg > 0) mkLine('zeroGammaLine', zg, COLORS.zeroGamma, 'Zero Gamma: $' + zg.toFixed(1));
        }

        return ann;
    }

    function render(data, spotPrice, series) {
        currentData = data;
        currentSpot = spotPrice;
        activeSeries = series;

        const ctx = document.getElementById('gexChart');
        if (!ctx) return;
        if (chartInstance) chartInstance.destroy();

        const { datasets, labels, filtered } = buildDatasets(data, spotPrice, series);
        const annotations = buildAnnotations(filtered, currentLevels, spotPrice);

        const legendEl = document.getElementById('chartLegend');
        if (legendEl) {
            const items = [];
            const seen = new Set();
            for (const ds of datasets) {
                if (seen.has(ds.label)) continue;
                seen.add(ds.label);
                const color = typeof ds.borderColor === 'function' ? ds.borderColor : ds.borderColor;
                items.push({ color, label: ds.label });
            }
            if (showSpot) items.push({ color: COLORS.spot, label: 'Spot Price' });
            if (showCallWall && currentLevels) items.push({ color: COLORS.callWall, label: 'Call Wall' });
            if (showPutWall && currentLevels) items.push({ color: COLORS.putWall, label: 'Put Wall' });
            if (showInflection && currentLevels) items.push({ color: COLORS.inflection, label: 'Inflection' });
            if (showZeroGamma && currentLevels) items.push({ color: COLORS.zeroGamma, label: 'Zero Gamma' });

            legendEl.innerHTML = items.map(item =>
                '<div class="legend-item">' +
                    '<div class="legend-color" style="background:' + item.color + '"></div>' +
                    '<span>' + item.label + '</span>' +
                '</div>'
            ).join('');
        }

        chartInstance = new Chart(ctx, {
            type: 'bar',
            data: { labels, datasets },
            options: {
                indexAxis: 'y',
                responsive: true,
                maintainAspectRatio: false,
                interaction: { mode: 'index', intersect: false },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: 'rgba(15, 15, 15, 0.95)',
                        titleColor: '#fafafa',
                        bodyColor: '#a3a3a3',
                        borderColor: '#262626',
                        borderWidth: 1,
                        padding: 10,
                        cornerRadius: 6,
                        titleFont: { family: "'JetBrains Mono', monospace", size: 12, weight: '600' },
                        bodyFont: { family: "'JetBrains Mono', monospace", size: 11 },
                        callbacks: {
                            title: (items) => 'Strike: $' + items[0].label,
                            label: (item) => item.dataset.label + ': ' + fmt(item.raw)
                        }
                    },
                    annotation: { annotations }
                },
                scales: {
                    y: {
                        grid: { color: COLORS.grid, drawBorder: false },
                        ticks: { color: COLORS.text, font: { family: "'JetBrains Mono', monospace", size: 10 }, maxTicksLimit: 50 },
                        border: { display: false }
                    },
                    x: {
                        type: 'linear',
                        display: true,
                        position: 'bottom',
                        grid: { color: COLORS.grid, drawBorder: false },
                        ticks: { color: COLORS.text, font: { family: "'JetBrains Mono', monospace", size: 9 }, callback: (val) => fmt(val) },
                        border: { display: false }
                    }
                },
                animation: { duration: 300, easing: 'easeOutQuart' }
            }
        });
    }

    function switchSeries(series) {
        activeSeries = series;
        document.querySelectorAll('.series-tab').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.series === series);
        });
        if (window.appState) window.appState.activeSeries = series;
        if (currentData && currentSpot) render(currentData, currentSpot, activeSeries);
    }

    function toggleElement(el) {
        switch (el) {
            case 'aggregate': showAggregate = !showAggregate; break;
            case 'net': showNet = !showNet; break;
            case 'split': showSplit = !showSplit; break;
            case 'callWall': showCallWall = !showCallWall; break;
            case 'putWall': showPutWall = !showPutWall; break;
            case 'inflection': showInflection = !showInflection; break;
            case 'zeroGamma': showZeroGamma = !showZeroGamma; break;
            case 'spot': showSpot = !showSpot; break;
        }
        if (currentData && currentSpot) render(currentData, currentSpot, activeSeries);
    }

    function setLevels(levels) { currentLevels = levels; }

    return { render, switchSeries, toggleElement, setLevels, activeSeries: () => activeSeries };
})();

window.chart = ChartBuilder;
