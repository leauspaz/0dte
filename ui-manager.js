/* ===== UI MANAGER ===== */

const UIManager = (function() {
    'use strict';

    const TICKER_PRESETS = {
        equity: ['SPY', 'QQQ', 'IWM', 'TSLA', 'NVDA', 'AAPL', 'META', 'AMZN', 'GOOGL', 'MSFT', 'AMD', 'NFLX', 'PLTR', 'HOOD', 'MSTR', 'SMCI', 'AVGO', 'JPM', 'BAC', 'XOM', 'UNH', 'V', 'PG', 'MA', 'HD', 'CVX', 'MRK', 'LLY', 'WMT', 'DIS'],
        index: ['^SPX', '^NDX', '^RUT', '^VIX', '^DJI', '^IXIC', '^FTSE', '^N225', '^HSI', '^GSPC', '^GSPTSE', '^AORD', '^BSESN', '^JKSE', '^KLSE', '^NZ50', '^STI', '^TWII', '^N100', '^OMX'],
        etf: ['SPY', 'QQQ', 'IWM', 'DIA', 'XLF', 'XLK', 'XLE', 'XLU', 'XLI', 'XLP', 'XLB', 'XRT', 'XHB', 'KRE', 'SMH', 'SOXX', 'IBB', 'XBI', 'ARKK', 'TLT', 'HYG', 'LQD', 'EFA', 'EEM', 'IEFA', 'VEA', 'VWO', 'VTI', 'VOO', 'QQQM']
    };

    let currentAssetClass = 'index';
    let sidebarOpen = false;

    function formatDate(timestamp) {
        if (typeof timestamp === 'string' && timestamp.includes('-')) {
            const d = new Date(timestamp + 'T00:00:00');
            return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        }
        const d = new Date(timestamp * 1000);
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }

    function formatDaysLeft(timestamp) {
        let expDate;
        if (typeof timestamp === 'string' && timestamp.includes('-')) {
            expDate = new Date(timestamp + 'T00:00:00');
        } else {
            expDate = new Date(timestamp * 1000);
        }
        const days = Math.ceil((expDate - Date.now()) / (1000 * 60 * 60 * 24));
        if (days <= 0) return 'Today';
        if (days === 1) return '1 day';
        return `${days} days`;
    }

    function formatPrice(price) {
        if (price === null || price === undefined) return '--';
        return price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }

    function formatNumber(num) {
        if (num === null || num === undefined) return '--';
        const abs = Math.abs(num);
        if (abs >= 1000000000) return (num / 1000000000).toFixed(2) + 'B';
        if (abs >= 1000000) return (num / 1000000).toFixed(2) + 'M';
        if (abs >= 1000) return (num / 1000).toFixed(1) + 'K';
        return num.toFixed(0);
    }

    function formatPercent(num) {
        if (num === null || num === undefined) return '--';
        return (num >= 0 ? '+' : '') + num.toFixed(2) + '%';
    }

    function toggleSidebar() {
        sidebarOpen = !sidebarOpen;
        const sidebar = document.getElementById('sidebar');
        if (sidebar) sidebar.classList.toggle('open', sidebarOpen);
    }

    function switchAssetClass(cls) {
        currentAssetClass = cls;
        document.querySelectorAll('.asset-tab').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.class === cls);
        });
        renderTickerGrid(TICKER_PRESETS[cls] || TICKER_PRESETS.equity);
    }

    function renderTickerGrid(tickers) {
        const grid = document.getElementById('tickerGrid');
        if (!grid) return;
        const currentTicker = document.getElementById('tickerInput')?.value?.toUpperCase() || '';
        grid.innerHTML = tickers.map(t => `
            <div class="ticker-btn ${t === currentTicker ? 'active' : ''}" onclick="ui.selectTicker('${t}')">${t}</div>
        `).join('');
    }

    function selectTicker(ticker) {
        const input = document.getElementById('tickerInput');
        if (input) input.value = ticker;
        document.querySelectorAll('.ticker-btn').forEach(btn => {
            btn.classList.toggle('active', btn.textContent === ticker);
        });
        if (window.innerWidth <= 1200) {
            sidebarOpen = false;
            document.getElementById('sidebar')?.classList.remove('open');
        }
        if (window.app && window.app.searchTicker) window.app.searchTicker();
    }

    function renderExpirations(expirations, selectedExp) {
        const list = document.getElementById('expList');
        const count = document.getElementById('expCount');
        if (!list) return;
        if (count) count.textContent = `${expirations.length} available`;
        if (expirations.length === 0) {
            list.innerHTML = '<div class="exp-placeholder">No expirations available</div>';
            return;
        }
        list.innerHTML = expirations.slice(0, 20).map(exp => {
            const isSelected = exp === selectedExp;
            return `
                <div class="exp-item ${isSelected ? 'selected' : ''}" data-exp="${exp}" onclick="ui.selectExp(this)">
                    <span>${formatDate(exp)}</span>
                    <span class="days">${formatDaysLeft(exp)}</span>
                </div>
            `;
        }).join('');
    }

    function selectExp(el) {
        const timestamp = el.getAttribute('data-exp');
        document.querySelectorAll('.exp-item').forEach(item => item.classList.remove('selected'));
        el.classList.add('selected');
        if (window.app && window.app.setExp) window.app.setExp(timestamp);
    }

    function renderKeyLevels(levels) {
        const card = document.getElementById('levelsCard');
        const list = document.getElementById('levelsList');
        if (!card || !list) return;
        card.style.display = 'block';

        const spotPrice = levels.spot_price !== undefined ? levels.spot_price : (levels.spotPrice || 0);
        const inflection = levels.inflection;
        const callWall = levels.call_wall !== undefined ? levels.call_wall : levels.callWall;
        const putWall = levels.put_wall !== undefined ? levels.put_wall : levels.putWall;
        const netGEX = levels.net_gex !== undefined ? levels.net_gex : levels.netGEX;
        const zeroGamma = levels.zero_gamma !== undefined ? levels.zero_gamma : levels.zeroGamma;
        const maxPain = levels.max_pain !== undefined ? levels.max_pain : levels.maxPain;

        const rows = [
            { label: 'Current Price', value: formatPrice(spotPrice), color: 'neutral', dot: 'var(--chart-neutral)' },
            { label: 'Gamma Inflection', value: formatPrice(inflection), color: 'accent', dot: 'var(--chart-accent)' },
            { label: 'Call Wall', value: formatPrice(callWall), color: 'positive', dot: 'var(--chart-positive)' },
            { label: 'Put Wall', value: formatPrice(putWall), color: 'negative', dot: 'var(--chart-negative)' },
            { label: 'Net GEX', value: formatNumber(netGEX), color: 'warn', dot: 'var(--chart-warn)' },
            { label: 'Zero Gamma', value: formatPrice(zeroGamma), color: 'neutral', dot: 'var(--chart-neutral)' },
            { label: 'Max Pain', value: formatPrice(maxPain), color: 'accent', dot: 'var(--chart-accent)' },
        ];

        list.innerHTML = rows.map(row => `
            <div class="level-row">
                <div class="level-label">
                    <span class="level-dot" style="background:${row.dot}"></span>
                    ${row.label}
                </div>
                <div class="level-value ${row.color}">${row.value}</div>
            </div>
        `).join('');
    }

    function renderPriceBar(quote, levels) {
        const bar = document.getElementById('priceBar');
        if (!bar) return;
        bar.style.display = 'grid';

        const inflectionEl = document.getElementById('statInflection');
        const inflectionDescEl = document.getElementById('statInflectionDesc');
        const zoneEl = document.getElementById('statZone');
        const zoneDescEl = document.getElementById('statZoneDesc');
        const totalGEXEl = document.getElementById('statTotalGEX');
        const totalGEXDescEl = document.getElementById('statTotalGEXDesc');
        const callWallEl = document.getElementById('statCallWall');
        const putWallEl = document.getElementById('statPutWall');

        const isPositiveGamma = levels.is_positive_gamma !== undefined ? levels.is_positive_gamma : levels.isPositiveGamma;
        const totalGEX = levels.total_gex !== undefined ? levels.total_gex : levels.totalGEX;
        const callWall = levels.call_wall !== undefined ? levels.call_wall : levels.callWall;
        const putWall = levels.put_wall !== undefined ? levels.put_wall : levels.putWall;
        const inflection = levels.inflection !== undefined ? levels.inflection : levels.inflection;
        const spotPrice = quote.price;

        if (inflectionEl) {
            inflectionEl.textContent = formatPrice(inflection);
            const dist = spotPrice - inflection;
            if (inflectionDescEl) {
                inflectionDescEl.textContent = `${dist >= 0 ? '+' : ''}${formatPrice(dist)} from spot`;
            }
        }
        if (zoneEl) {
            if (isPositiveGamma) {
                zoneEl.textContent = 'Positive';
                zoneEl.style.color = 'var(--chart-positive)';
                if (zoneDescEl) zoneDescEl.textContent = 'Stabilizing';
            } else {
                zoneEl.textContent = 'Negative';
                zoneEl.style.color = 'var(--chart-negative)';
                if (zoneDescEl) zoneDescEl.textContent = 'Amplifying';
            }
        }
        if (totalGEXEl) totalGEXEl.textContent = formatNumber(totalGEX);
        if (totalGEXDescEl) totalGEXDescEl.textContent = totalGEX > 0 ? 'Net Long' : 'Net Short';
        if (callWallEl) callWallEl.textContent = formatPrice(callWall);
        if (putWallEl) putWallEl.textContent = formatPrice(putWall);
    }

    function updateRegimeBadge(isPositive) {
        const pill = document.getElementById('regimePill');
        const text = document.getElementById('regimeText');
        if (!pill || !text) return;
        pill.className = `status-pill ${isPositive ? 'positive' : 'negative'}`;
        text.textContent = isPositive ? 'Positive Gamma' : 'Negative Gamma';
    }

    function renderGreeksPanel(levels, summary) {
        const panel = document.getElementById('greeksPanel');
        if (!panel) return;
        panel.style.display = 'grid';

        const maxPain = levels.max_pain !== undefined ? levels.max_pain : levels.maxPain;
        const netDEX = levels.net_dex !== undefined ? levels.net_dex : levels.netDEX;
        const totalVanna = levels.total_vanna !== undefined ? levels.total_vanna : levels.totalVanna;
        const totalCharm = levels.total_charm !== undefined ? levels.total_charm : levels.totalCharm;
        const ivSkew = levels.iv_skew !== undefined ? levels.iv_skew : levels.ivSkew;

        const maxPainEl = document.getElementById('greekMaxPain');
        const pcrEl = document.getElementById('greekPCR');
        const pcrDescEl = document.getElementById('greekPCRDesc');
        const netDeltaEl = document.getElementById('greekNetDelta');
        const netVannaEl = document.getElementById('greekNetVanna');
        const netCharmEl = document.getElementById('greekNetCharm');
        const ivSkewEl = document.getElementById('greekIVSkew');
        const ivSkewDescEl = document.getElementById('greekIVSkewDesc');

        if (maxPainEl) maxPainEl.textContent = formatPrice(maxPain);
        if (pcrEl && summary) {
            const pcr = summary.put_call_ratio !== undefined ? summary.put_call_ratio :
                       (summary.total_put_oi || summary.totalPutOI || 1) / (summary.total_call_oi || summary.totalCallOI || 1);
            pcrEl.textContent = pcr.toFixed(2);
            if (pcrDescEl) pcrDescEl.textContent = pcr > 1.2 ? 'Bearish skew' : pcr < 0.8 ? 'Bullish skew' : 'Neutral';
        }
        if (netDeltaEl) netDeltaEl.textContent = formatNumber(netDEX);
        if (netVannaEl) netVannaEl.textContent = formatNumber(totalVanna);
        if (netCharmEl) netCharmEl.textContent = formatNumber(totalCharm);
        if (ivSkewEl) {
            ivSkewEl.textContent = (ivSkew || 0).toFixed(2) + '%';
            if (ivSkewDescEl) {
                const skew = ivSkew || 0;
                ivSkewDescEl.textContent = skew > 2 ? 'Fear premium (puts expensive)' : skew < -1 ? 'Call skew (bullish)' : 'Normal skew';
            }
        }
    }

    function renderRegimeAnalysis(levels, quote) {
        const card = document.getElementById('analysisCard');
        const content = document.getElementById('analysisContent');
        if (!card || !content) return;
        card.style.display = 'block';

        const spot = quote.price;
        const inflection = levels.inflection;
        const callWall = levels.call_wall !== undefined ? levels.call_wall : levels.callWall;
        const putWall = levels.put_wall !== undefined ? levels.put_wall : levels.putWall;
        const netDEX = levels.net_dex !== undefined ? levels.net_dex : levels.netDEX;
        const totalVanna = levels.total_vanna !== undefined ? levels.total_vanna : levels.totalVanna;
        const totalCharm = levels.total_charm !== undefined ? levels.total_charm : levels.totalCharm;
        const isPositiveGamma = levels.is_positive_gamma !== undefined ? levels.is_positive_gamma : levels.isPositiveGamma;

        const distToInflection = spot - inflection;
        const distToCall = callWall - spot;
        const distToPut = spot - putWall;

        let html = '';
        if (isPositiveGamma) {
            html += `<p><span class="highlight-positive">Positive Gamma Zone:</span> Price ($${formatPrice(spot)}) is <strong>above</strong> the inflection point ($${formatPrice(inflection)}).</p>`;
            html += `<p>Market makers are <strong>net long gamma</strong> and will <span class="highlight-positive">sell into rallies, buy into dips</span> - this is a <strong>stabilizing, mean-reverting</strong> regime.</p>`;
            html += `<p>The Call Wall at <span class="highlight-positive">$${formatPrice(callWall)}</span> (${distToCall > 0 ? '+' : ''}${formatPrice(distToCall)} away) acts as resistance where selling pressure may intensify.</p>`;
            html += `<p>The Put Wall at <span class="highlight-negative">$${formatPrice(putWall)}</span> (${distToPut > 0 ? '+' : ''}${formatPrice(distToPut)} below) acts as support where buying interest may emerge.</p>`;
            html += `<p><strong>Net DEX:</strong> ${formatNumber(netDEX)} - ${netDEX > 0 ? 'net long delta (bullish bias)' : 'net short delta (bearish bias)'}</p>`;
        } else {
            html += `<p><span class="highlight-negative">Negative Gamma Zone:</span> Price ($${formatPrice(spot)}) is <strong>below</strong> the inflection point ($${formatPrice(inflection)}).</p>`;
            html += `<p>Market makers are <strong>net short gamma</strong> and will <span class="highlight-negative">buy into rallies, sell into dips</span> - this is an <strong>amplifying, trending/volatile</strong> regime.</p>`;
            html += `<p>The inflection at <span class="highlight-warn">$${formatPrice(inflection)}</span> (${distToInflection > 0 ? '+' : ''}${formatPrice(distToInflection)} above) is the key level to reclaim for stabilization.</p>`;
            html += `<p>Below the Put Wall at <span class="highlight-negative">$${formatPrice(putWall)}</span>, downside moves may accelerate as dealers are forced to sell into weakness.</p>`;
            html += `<p><strong>Net DEX:</strong> ${formatNumber(netDEX)} - ${netDEX > 0 ? 'net long delta (bullish bias despite negative gamma)' : 'net short delta (bearish bias amplified)'}</p>`;
        }
        html += `<p style="margin-top:12px;"><strong>Vanna:</strong> ${formatNumber(totalVanna)} - ${Math.abs(totalVanna) > 1000000 ? 'High vol sensitivity. IV moves will shift delta significantly.' : 'Moderate vol sensitivity.'}</p>`;
        html += `<p><strong>Charm:</strong> ${formatNumber(totalCharm)} - ${Math.abs(totalCharm) > 500000 ? 'Significant time decay. Delta hedges will shift rapidly into expiry.' : 'Normal time decay profile.'}</p>`;
        content.innerHTML = html;
    }

    function showLoading() {
        const overlay = document.getElementById('loadingOverlay');
        if (overlay) overlay.classList.add('active');
    }

    function hideLoading() {
        const overlay = document.getElementById('loadingOverlay');
        if (overlay) overlay.classList.remove('active');
    }

    function updateChartTitle(ticker, expDate) {
        const tickerEl = document.getElementById('chartTicker');
        const expEl = document.getElementById('chartExp');
        if (tickerEl) tickerEl.textContent = ticker;
        if (expEl) expEl.textContent = expDate ? `(${formatDate(expDate)})` : '';
    }

    function updateLastUpdate() {
        const el = document.getElementById('lastUpdate');
        if (el) el.textContent = new Date().toLocaleTimeString();
    }

    function setGenerateEnabled(enabled) {
        const btn = document.getElementById('generateBtn');
        if (btn) btn.disabled = !enabled;
    }

    function showError(message, retryCallback) {
        const expList = document.getElementById('expList');
        if (!expList) return;

        const isNoOptions = message.includes('No options') || message.includes('No options expirations') || message.includes('does not have options');
        const ticker = document.getElementById('tickerInput')?.value?.toUpperCase() || '';
        const unsupported = ['ES=', 'NQ=', 'YM=', 'RTY=', 'GC=', 'SI=', 'CL=', 'NG=', 'ZB=', 'ZN=', 'ZW=', 'ZC=', 'ZS=', 'KC=', 'CT=', 'CC=', 'SB=', 'HG=', 'PA=', 'PL=', 'BTC-', 'ETH-', 'SOL-', 'XRP-', 'ADA-', 'DOGE-', 'EURUSD=', 'GBPUSD=', 'USDJPY=', 'AUDUSD='];
        const isUnsupported = unsupported.some(p => ticker.startsWith(p));

        let extraMsg = '';
        if (isNoOptions && isUnsupported) {
            extraMsg = '<div style="margin-top:8px;font-size:11px;opacity:0.7;">This ticker type does not have options data on Yahoo Finance. Try SPY, QQQ, TSLA, NVDA, AAPL, or other individual stocks/ETFs.</div>';
        } else if (isNoOptions) {
            extraMsg = '<div style="margin-top:8px;font-size:11px;opacity:0.7;">This ticker may not have options, or Yahoo Finance may be temporarily unavailable. Try SPY or QQQ to verify the connection.</div>';
        }

        expList.innerHTML = `
            <div class="error-msg">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/></svg>
                <div style="flex:1">
                    <div style="font-weight:600;">Error</div>
                    <div style="margin-top:4px;font-size:12px;opacity:0.8;">${message}</div>
                    ${extraMsg}
                </div>
                ${retryCallback ? '<button onclick="' + retryCallback + '()">Retry</button>' : ''}
            </div>
        `;
    }

    function init() {
        renderTickerGrid(TICKER_PRESETS.index);
        document.addEventListener('click', (e) => {
            const sidebar = document.getElementById('sidebar');
            const toggle = document.getElementById('mobileNavToggle');
            if (sidebar && toggle && sidebarOpen && !sidebar.contains(e.target) && !toggle.contains(e.target)) {
                sidebarOpen = false;
                sidebar.classList.remove('open');
            }
        });
        const input = document.getElementById('tickerInput');
        if (input) {
            input.addEventListener('keypress', (e) => {
                if (e.key === 'Enter' && window.app && window.app.searchTicker) window.app.searchTicker();
            });
        }
    }

    return {
        init, toggleSidebar, switchAssetClass, selectTicker, renderTickerGrid,
        renderExpirations, selectExp, renderKeyLevels, renderPriceBar,
        updateRegimeBadge, renderGreeksPanel, renderRegimeAnalysis,
        showLoading, hideLoading, updateChartTitle, updateLastUpdate,
        setGenerateEnabled, showError,
        formatDate, formatDaysLeft, formatPrice, formatNumber, formatPercent,
        TICKER_PRESETS
    };
})();

window.ui = UIManager;
