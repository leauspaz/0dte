/* ===== CHART BUILDER =====
 * Configures and renders Chart.js charts for GEX, DEX, Vanna, Charm, OI, IV Skew
 */

const ChartBuilder = (function() {
    'use strict';

    let chartInstance = null;
    let currentData = null;
    let activeSeries = ['gex', 'dex'];

    // ===== COLOR PALETTE =====
    const COLORS = {
        callGEX: 'rgba(0, 230, 118, 0.65)',
        callGEXBorder: 'rgba(0, 230, 118, 0.9)',
        putGEX: 'rgba(255, 23, 68, 0.65)',
        putGEXBorder: 'rgba(255, 23, 68, 0.9)',
        aggregateGEX: 'rgba(170, 0, 255, 0.9)',
        aggregateGEXFill: 'rgba(170, 0, 255, 0.08)',
        netGEX: 'rgba(255, 234, 0, 0.95)',
        netGEXFill: 'rgba(255, 234, 0, 0.05)',
        dex: 'rgba(41, 121, 255, 0.9)',
        dexFill: 'rgba(41, 121, 255, 0.08)',
        vanna: 'rgba(255, 145, 0, 0.9)',
        vannaFill: 'rgba(255, 145, 0, 0.08)',
        charm: 'rgba(0, 229, 255, 0.9)',
        charmFill: 'rgba(0, 229, 255, 0.08)',
        oi: 'rgba(160, 160, 176, 0.7)',
        iv: 'rgba(255, 105, 180, 0.9)',
        grid: 'rgba(255, 255, 255, 0.04)',
        text: '#555560',
        textLight: '#777788'
    };

    // ===== LEGEND CONFIG =====
    const LEGENDS = {
        gex: [
            { color: 'rgba(170, 0, 255, 0.7)', label: 'Aggregate GEX' },
            { color: 'rgba(255, 23, 68, 0.7)', label: 'Put GEX' },
            { color: 'rgba(0, 230, 118, 0.7)', label: 'Call GEX' },
            { color: 'rgba(255, 234, 0, 0.9)', label: 'Net GEX (Cumulative)' }
        ],
        dex: [
            { color: 'rgba(41, 121, 255, 0.9)', label: 'Net DEX (Cumulative)' },
            { color: 'rgba(0, 230, 118, 0.6)', label: 'Call DEX' },
            { color: 'rgba(255, 23, 68, 0.6)', label: 'Put DEX' }
        ],
        vanna: [
            { color: 'rgba(255, 145, 0, 0.9)', label: 'Net Vanna' },
            { color: 'rgba(0, 230, 118, 0.6)', label: 'Call Vanna' },
            { color: 'rgba(255, 23, 68, 0.6)', label: 'Put Vanna' }
        ],
        charm: [
            { color: 'rgba(0, 229, 255, 0.9)', label: 'Net Charm' },
            { color: 'rgba(0, 230, 118, 0.6)', label: 'Call Charm' },
            { color: 'rgba(255, 23, 68, 0.6)', label: 'Put Charm' }
        ],
        oi: [
            { color: 'rgba(0, 230, 118, 0.6)', label: 'Call OI' },
            { color: 'rgba(255, 23, 68, 0.6)', label: 'Put OI' },
            { color: 'rgba(160, 160, 176, 0.7)', label: 'Total OI' }
        ],
        iv: [
            { color: 'rgba(255, 105, 180, 0.9)', label: 'Call IV' },
            { color: 'rgba(0, 229, 255, 0.9)', label: 'Put IV' },
            { color: 'rgba(255, 234, 0, 0.9)', label: 'IV Skew (Put - Call)' }
        ]
    };

    // ===== TOOLTIP FORMATTER =====
    function formatTooltipValue(val) {
        const abs = Math.abs(val);
        if (abs >= 1000000000) return (val / 1000000000).toFixed(2) + 'B';
        if (abs >= 1000000) return (val / 1000000).toFixed(2) + 'M';
        if (abs >= 1000) return (val / 1000).toFixed(1) + 'K';
        return val.toFixed(0);
    }

    // ===== BUILD DATASETS =====
    function buildDatasets(data, spotPrice, series) {
        const datasets = [];
        const labels = data.map(d => d.strike.toFixed(1));

        // Filter to strikes near spot (within 12% for cleaner chart)
        const range = 0.12;
        const minStrike = spotPrice * (1 - range);
        const maxStrike = spotPrice * (1 + range);
        const filtered = data.filter(d => d.strike >= minStrike && d.strike <= maxStrike);
        const filteredLabels = filtered.map(d => d.strike.toFixed(1));

        // Find spot index for annotation
        const spotIndex = filtered.findIndex(d => d.strike >= spotPrice);

        if (series.includes('gex')) {
            // Aggregate GEX line
            datasets.push({
                label: 'Aggregate GEX',
                data: filtered.map(d => d.aggregateGEX),
                borderColor: COLORS.aggregateGEX,
                backgroundColor: COLORS.aggregateGEXFill,
                borderWidth: 2,
                type: 'line',
                yAxisID: 'y1',
                tension: 0.3,
                pointRadius: 0,
                pointHoverRadius: 4,
                fill: false,
                order: 1
            });

            // Put GEX bars
            datasets.push({
                label: 'Put GEX',
                data: filtered.map(d => d.putGEX),
                backgroundColor: COLORS.putGEX,
                borderColor: COLORS.putGEXBorder,
                borderWidth: 1,
                type: 'bar',
                yAxisID: 'y',
                barPercentage: 0.65,
                categoryPercentage: 0.8,
                order: 3
            });

            // Call GEX bars
            datasets.push({
                label: 'Call GEX',
                data: filtered.map(d => d.callGEX),
                backgroundColor: COLORS.callGEX,
                borderColor: COLORS.callGEXBorder,
                borderWidth: 1,
                type: 'bar',
                yAxisID: 'y',
                barPercentage: 0.65,
                categoryPercentage: 0.8,
                order: 2
            });

            // Net GEX cumulative line
            datasets.push({
                label: 'Net GEX (Cumulative)',
                data: filtered.map(d => d.cumulativeGEX),
                borderColor: COLORS.netGEX,
                backgroundColor: COLORS.netGEXFill,
                borderWidth: 2.5,
                type: 'line',
                yAxisID: 'y1',
                tension: 0.3,
                pointRadius: 0,
                pointHoverRadius: 4,
                fill: false,
                order: 0
            });
        }

        if (series.includes('dex')) {
            datasets.push({
                label: 'Net DEX (Cumulative)',
                data: filtered.map(d => d.cumulativeDEX),
                borderColor: COLORS.dex,
                backgroundColor: COLORS.dexFill,
                borderWidth: 2,
                type: 'line',
                yAxisID: 'y1',
                tension: 0.3,
                pointRadius: 0,
                pointHoverRadius: 4,
                fill: false,
                order: 0
            });

            datasets.push({
                label: 'Call DEX',
                data: filtered.map(d => d.callDEX),
                backgroundColor: 'rgba(0, 230, 118, 0.4)',
                borderColor: 'rgba(0, 230, 118, 0.6)',
                borderWidth: 1,
                type: 'bar',
                yAxisID: 'y',
                barPercentage: 0.5,
                order: 2
            });

            datasets.push({
                label: 'Put DEX',
                data: filtered.map(d => d.putDEX),
                backgroundColor: 'rgba(255, 23, 68, 0.4)',
                borderColor: 'rgba(255, 23, 68, 0.6)',
                borderWidth: 1,
                type: 'bar',
                yAxisID: 'y',
                barPercentage: 0.5,
                order: 3
            });
        }

        if (series.includes('vanna')) {
            datasets.push({
                label: 'Net Vanna',
                data: filtered.map(d => d.totalVanna),
                borderColor: COLORS.vanna,
                backgroundColor: COLORS.vannaFill,
                borderWidth: 2,
                type: 'line',
                yAxisID: 'y1',
                tension: 0.3,
                pointRadius: 0,
                pointHoverRadius: 4,
                fill: false,
                order: 0
            });

            datasets.push({
                label: 'Call Vanna',
                data: filtered.map(d => d.callVanna),
                backgroundColor: 'rgba(0, 230, 118, 0.35)',
                borderColor: 'rgba(0, 230, 118, 0.5)',
                borderWidth: 1,
                type: 'bar',
                yAxisID: 'y',
                barPercentage: 0.5,
                order: 2
            });

            datasets.push({
                label: 'Put Vanna',
                data: filtered.map(d => d.putVanna),
                backgroundColor: 'rgba(255, 23, 68, 0.35)',
                borderColor: 'rgba(255, 23, 68, 0.5)',
                borderWidth: 1,
                type: 'bar',
                yAxisID: 'y',
                barPercentage: 0.5,
                order: 3
            });
        }

        if (series.includes('charm')) {
            datasets.push({
                label: 'Net Charm',
                data: filtered.map(d => d.totalCharm),
                borderColor: COLORS.charm,
                backgroundColor: COLORS.charmFill,
                borderWidth: 2,
                type: 'line',
                yAxisID: 'y1',
                tension: 0.3,
                pointRadius: 0,
                pointHoverRadius: 4,
                fill: false,
                order: 0
            });

            datasets.push({
                label: 'Call Charm',
                data: filtered.map(d => d.callCharm),
                backgroundColor: 'rgba(0, 230, 118, 0.35)',
                borderColor: 'rgba(0, 230, 118, 0.5)',
                borderWidth: 1,
                type: 'bar',
                yAxisID: 'y',
                barPercentage: 0.5,
                order: 2
            });

            datasets.push({
                label: 'Put Charm',
                data: filtered.map(d => d.putCharm),
                backgroundColor: 'rgba(255, 23, 68, 0.35)',
                borderColor: 'rgba(255, 23, 68, 0.5)',
                borderWidth: 1,
                type: 'bar',
                yAxisID: 'y',
                barPercentage: 0.5,
                order: 3
            });
        }

        if (series.includes('oi')) {
            datasets.push({
                label: 'Call OI',
                data: filtered.map(d => d.callOI),
                backgroundColor: 'rgba(0, 230, 118, 0.5)',
                borderColor: 'rgba(0, 230, 118, 0.7)',
                borderWidth: 1,
                type: 'bar',
                yAxisID: 'y',
                barPercentage: 0.6,
                order: 1
            });

            datasets.push({
                label: 'Put OI',
                data: filtered.map(d => d.putOI),
                backgroundColor: 'rgba(255, 23, 68, 0.5)',
                borderColor: 'rgba(255, 23, 68, 0.7)',
                borderWidth: 1,
                type: 'bar',
                yAxisID: 'y',
                barPercentage: 0.6,
                order: 2
            });

            datasets.push({
                label: 'Total OI',
                data: filtered.map(d => d.totalOI),
                borderColor: COLORS.oi,
                backgroundColor: 'rgba(160, 160, 176, 0.1)',
                borderWidth: 2,
                type: 'line',
                yAxisID: 'y1',
                tension: 0.3,
                pointRadius: 0,
                pointHoverRadius: 4,
                fill: false,
                order: 0
            });
        }

        if (series.includes('iv')) {
            datasets.push({
                label: 'Call IV',
                data: filtered.map(d => d.callIV * 100),
                borderColor: 'rgba(255, 105, 180, 0.9)',
                backgroundColor: 'rgba(255, 105, 180, 0.1)',
                borderWidth: 2,
                type: 'line',
                yAxisID: 'y1',
                tension: 0.3,
                pointRadius: 0,
                pointHoverRadius: 4,
                fill: false,
                order: 0
            });

            datasets.push({
                label: 'Put IV',
                data: filtered.map(d => d.putIV * 100),
                borderColor: 'rgba(0, 229, 255, 0.9)',
                backgroundColor: 'rgba(0, 229, 255, 0.1)',
                borderWidth: 2,
                type: 'line',
                yAxisID: 'y1',
                tension: 0.3,
                pointRadius: 0,
                pointHoverRadius: 4,
                fill: false,
                order: 1
            });

            datasets.push({
                label: 'IV Skew',
                data: filtered.map(d => (d.putIV - d.callIV) * 100),
                borderColor: COLORS.netGEX,
                backgroundColor: 'rgba(255, 234, 0, 0.05)',
                borderWidth: 2,
                type: 'line',
                yAxisID: 'y1',
                tension: 0.3,
                pointRadius: 0,
                pointHoverRadius: 4,
                borderDash: [5, 5],
                fill: false,
                order: 2
            });
        }

        return { datasets, labels: filteredLabels, spotIndex };
    }

    // ===== RENDER CHART =====
    function render(data, spotPrice, series) {
        currentData = data;
        activeSeries = series;

        const ctx = document.getElementById('gexChart');
        if (!ctx) return;

        if (chartInstance) {
            chartInstance.destroy();
        }

        const { datasets, labels, spotIndex } = buildDatasets(data, spotPrice, series);

        // Build legend
        const legendEl = document.getElementById('chartLegend');
        if (legendEl) {
            legendEl.innerHTML = '';
            const seen = new Set();
            for (const s of series) {
                for (const item of (LEGENDS[s] || [])) {
                    if (seen.has(item.label)) continue;
                    seen.add(item.label);
                    legendEl.innerHTML += `
                        <div class="legend-item">
                            <div class="legend-color" style="background:${item.color}"></div>
                            <span>${item.label}</span>
                        </div>
                    `;
                }
            }
        }

        chartInstance = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: datasets
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    mode: 'index',
                    intersect: false
                },
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        backgroundColor: 'rgba(18, 18, 26, 0.95)',
                        titleColor: '#e0e0e0',
                        bodyColor: '#888',
                        borderColor: '#2a2a3a',
                        borderWidth: 1,
                        padding: 12,
                        cornerRadius: 8,
                        titleFont: {
                            family: "'SF Mono', Monaco, monospace",
                            size: 13
                        },
                        bodyFont: {
                            family: "'SF Mono', Monaco, monospace",
                            size: 12
                        },
                        callbacks: {
                            title: (items) => `Strike: $${items[0].label}`,
                            label: (item) => {
                                const val = item.raw;
                                const formatted = formatTooltipValue(val);
                                return `${item.dataset.label}: ${formatted}`;
                            }
                        }
                    },
                    annotation: {
                        annotations: spotIndex >= 0 ? {
                            spotLine: {
                                type: 'line',
                                xMin: spotIndex,
                                xMax: spotIndex,
                                borderColor: 'rgba(0, 229, 255, 0.6)',
                                borderWidth: 2,
                                borderDash: [6, 4],
                                label: {
                                    content: 'Spot',
                                    enabled: true,
                                    position: 'start',
                                    backgroundColor: 'rgba(0, 229, 255, 0.2)',
                                    color: '#00e5ff',
                                    font: { size: 11 }
                                }
                            }
                        } : {}
                    }
                },
                scales: {
                    x: {
                        grid: {
                            color: COLORS.grid,
                            drawBorder: false
                        },
                        ticks: {
                            color: COLORS.text,
                            font: {
                                family: "'SF Mono', Monaco, monospace",
                                size: 10
                            },
                            maxTicksLimit: 20
                        },
                        border: {
                            display: false
                        }
                    },
                    y: {
                        type: 'linear',
                        display: true,
                        position: 'left',
                        grid: {
                            color: COLORS.grid,
                            drawBorder: false
                        },
                        ticks: {
                            color: COLORS.text,
                            font: {
                                family: "'SF Mono', Monaco, monospace",
                                size: 10
                            },
                            callback: (val) => formatTooltipValue(val)
                        },
                        border: {
                            display: false
                        }
                    },
                    y1: {
                        type: 'linear',
                        display: true,
                        position: 'right',
                        grid: {
                            drawOnChartArea: false
                        },
                        ticks: {
                            color: COLORS.textLight,
                            font: {
                                family: "'SF Mono', Monaco, monospace",
                                size: 10
                            },
                            callback: (val) => formatTooltipValue(val)
                        },
                        border: {
                            display: false
                        }
                    }
                },
                animation: {
                    duration: 400,
                    easing: 'easeOutQuart'
                }
            }
        });
    }

    // ===== TOGGLE SERIES =====
    function toggleSeries(series) {
        const idx = activeSeries.indexOf(series);
        if (idx >= 0) {
            if (activeSeries.length > 1) {
                activeSeries.splice(idx, 1);
            }
        } else {
            activeSeries.push(series);
        }

        // Update button states
        document.querySelectorAll('.ctrl-btn').forEach(btn => {
            const s = btn.dataset.series;
            btn.classList.toggle('active', activeSeries.includes(s));
        });

        if (currentData) {
            // Need spot price from app state
            const spotPrice = window.appState?.spotPrice || currentData[Math.floor(currentData.length / 2)].strike;
            render(currentData, spotPrice, activeSeries);
        }
    }

    // ===== PUBLIC API =====
    return {
        render,
        toggleSeries,
        activeSeries: () => activeSeries
    };
})();
