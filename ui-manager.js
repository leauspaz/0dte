/* ===== UI MANAGER =====
 * Handles all DOM interactions, mobile navigation, ticker grids, 
 * key levels display, greeks panel, and regime analysis
 */

const UIManager = (function() {
    'use strict';

    // ===== TICKER PRESETS =====
    const TICKER_PRESETS = {
        equity: ['SPY', 'SPX', 'QQQ', 'IWM', 'VIX', 'TSLA', 'NVDA', 'AAPL', 'META', 'AMZN', 'GOOGL', 'MSFT', 'AMD', 'COIN', 'NFLX', 'PLTR', 'HOOD', 'MSTR', 'SMCI', 'AVGO'],
        etf: ['SPY', 'QQQ', 'IWM', 'DIA', 'XLF', 'XLK', 'XLE', 'XLU', 'XLI', 'XLP', 'XLB', 'XRT', 'XHB', 'KRE', 'SMH', 'SOXX', 'IBB', 'XBI', 'ARKK', 'TLT'],
        futures: ['ES=F', 'NQ=F', 'YM=F', 'RTY=F', 'GC=F', 'SI=F', 'CL=F', 'NG=F', 'ZB=F', 'ZN=F', 'ZW=F', 'ZC=F', 'ZS=F', 'KC=F', 'CT=F', 'CC=F', 'SB=F', 'HG=F', 'PA=F', 'PL=F'],
        crypto: ['BTC-USD', 'ETH-USD', 'SOL-USD', 'XRP-USD', 'ADA-USD', 'DOGE-USD', 'DOT-USD', 'AVAX-USD', 'LINK-USD', 'MATIC-USD', 'LTC-USD', 'BCH-USD', 'UNI-USD', 'ETC-USD', 'XLM-USD', 'ALGO-USD', 'FIL-USD', 'ATOM-USD', 'NEAR-USD', 'ICP-USD'],
        fx: ['EURUSD=X', 'GBPUSD=X', 'USDJPY=X', 'AUDUSD=X', 'USDCAD=X', 'USDCHF=X', 'NZDUSD=X', 'EURGBP=X', 'EURJPY=X', 'GBPJPY=X', 'USDCNH=X', 'USDSEK=X', 'USDNOK=X', 'USDMXN=X', 'USDZAR=X', 'USDBRL=X', 'USDTRY=X', 'USDKRW=X', 'USDSGD=X', 'USDHKD=X'],
        commodity: ['GC=F', 'SI=F', 'CL=F', 'NG=F', 'HG=F', 'PA=F', 'PL=F', 'ALI=F', 'ZW=F', 'ZC=F', 'ZS=F', 'KC=F', 'CT=F', 'CC=F', 'SB=F', 'LB=F', 'OJ=F']
    };

    let currentAssetClass = 'equity';
    let sidebarOpen = false;

    // ===== FORMATTERS =====
    function formatDate(timestamp) {
        const d = new Date(timestamp * 1000);
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }

    function formatDaysLeft(timestamp) {
        const days = Math.ceil((timestamp * 1000 - Date.now()) / (1000 * 60 * 60 * 24));
        if (days <= 0) return 'Today';
        if (days === 1) return '1 day';
        return `${days} days`;
    }

    function formatPrice(price) {
        if (!price && price !== 0) return '--';
        return price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }

    function formatNumber(num) {
        if (!num && num !== 0) return '--';
        const abs = Math.abs(num);
        if (abs >= 1000000000) return (num / 1000000000).toFixed(2) + 'B';
        if (abs >= 1000000) return (num / 1000000).toFixed(2) + 'M';
        if (abs >= 1000) return (num / 1000).toFixed(1) + 'K';
        return num.toFixed(0);
    }

    function formatPercent(num) {
        if (!num && num !== 0) return '--';
        return (num >= 0 ? '+' : '') + num.toFixed(2) + '%';
    }

    // ===== SIDEBAR TOGGLE =====
    function toggleSidebar() {
        sidebarOpen = !sidebarOpen;
        const sidebar = document.getElementById('sidebar');
        if (sidebar) {
            sidebar.classList.toggle('open', sidebarOpen);
        }
    }

    // ===== ASSET CLASS SWITCH =====
    function switchAssetClass(cls) {
        currentAssetClass = cls;

        // Update tabs
        document.querySelectorAll('.asset-tab').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.class === cls);
        });

        // Update ticker grid
        renderTickerGrid(TICKER_PRESETS[cls] || TICKER_PRESETS.equity);
    }

    // ===== TICKER GRID =====
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

        // Update active state
        document.querySelectorAll('.ticker-btn').forEach(btn => {
            btn.classList.toggle('active', btn.textContent === ticker);
        });

        // Close sidebar on mobile
        if (window.innerWidth <= 1200) {
            sidebarOpen = false;
            document.getElementById('sidebar')?.classList.remove('open');
        }

        // Trigger search
        if (window.app && window.app.searchTicker) {
            window.app.searchTicker();
        }
    }

    // ===== EXPirations =====
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
                <div class="exp-item ${isSelected ? 'selected' : ''}" onclick="ui.selectExp(${exp}, this)">
                    <span>${formatDate(exp)}</span>
                    <span class="days">${formatDaysLeft(exp)}</span>
                </div>
            `;
        }).join('');
    }

    function selectExp(timestamp, el) {
        // Remove selected from all
        document.querySelectorAll('.exp-item').forEach(item => item.classList.remove('selected'));
        // Add to clicked
        el.classList.add('selected');

        // Update app state
        if (window.app && window.app.setExp) {
            window.app.setExp(timestamp);
        }
    }

    // ===== KEY LEVELS =====
    function renderKeyLevels(levels) {
        const card = document.getElementById('levelsCard');
        const list = document.getElementById('levelsList');
        if (!card || !list) return;

        card.style.display = 'block';

        const rows = [
            { label: 'Current Price', value: formatPrice(levels.spotPrice || 0), color: 'cyan', dot: '#00e5ff' },
            { label: 'Gamma Inflection', value: formatPrice(levels.inflection), color: 'purple', dot: '#aa00ff' },
            { label: 'Call Wall', value: formatPrice(levels.callWall), color: 'green', dot: '#00e676' },
            { label: 'Put Wall', value: formatPrice(levels.putWall), color: 'red', dot: '#ff1744' },
            { label: 'Net GEX', value: formatNumber(levels.netGEX), color: 'yellow', dot: '#ffea00' },
            { label: 'Zero Gamma', value: formatPrice(levels.zeroGamma), color: 'cyan', dot: '#00e5ff' },
            { label: 'Max Pain', value: formatPrice(levels.maxPain), color: 'purple', dot: '#aa00ff' },
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

    // ===== PRICE BAR =====
    function renderPriceBar(quote, levels) {
        const bar = document.getElementById('priceBar');
        if (!bar) return;
        bar.style.display = 'grid';

        const priceEl = document.getElementById('statPrice');
        const changeEl = document.getElementById('statChange');
        const zoneEl = document.getElementById('statZone');
        const zoneDescEl = document.getElementById('statZoneDesc');
        const totalGEXEl = document.getElementById('statTotalGEX');
        const totalGEXDescEl = document.getElementById('statTotalGEXDesc');
        const callWallEl = document.getElementById('statCallWall');
        const putWallEl = document.getElementById('statPutWall');

        if (priceEl) priceEl.textContent = formatPrice(quote.price);
        if (changeEl) {
            changeEl.textContent = `${quote.change >= 0 ? '+' : ''}${formatPrice(quote.change)} (${formatPercent(quote.changePercent)})`;
            changeEl.className = `price-change ${quote.change >= 0 ? 'up' : 'down'}`;
        }

        if (zoneEl) {
            if (levels.isPositiveGamma) {
                zoneEl.textContent = 'Positive';
                zoneEl.style.color = '#00e676';
                if (zoneDescEl) zoneDescEl.textContent = 'Stabilizing / Mean-reverting';
            } else {
                zoneEl.textContent = 'Negative';
                zoneEl.style.color = '#ff1744';
                if (zoneDescEl) zoneDescEl.textContent = 'Amplifying / Trending';
            }
        }

        if (totalGEXEl) totalGEXEl.textContent = formatNumber(levels.totalGEX);
        if (totalGEXDescEl) totalGEXDescEl.textContent = levels.totalGEX > 0 ? 'Net Long Gamma' : 'Net Short Gamma';

        if (callWallEl) callWallEl.textContent = formatPrice(levels.callWall);
        if (putWallEl) putWallEl.textContent = formatPrice(levels.putWall);
    }

    // ===== REGIME BADGE =====
    function updateRegimeBadge(isPositive) {
        const pill = document.getElementById('regimePill');
        const text = document.getElementById('regimeText');
        if (!pill || !text) return;

        pill.className = `status-pill ${isPositive ? 'positive' : 'negative'}`;
        text.textContent = isPositive ? 'Positive Gamma' : 'Negative Gamma';
    }

    // ===== GREEKS PANEL =====
    function renderGreeksPanel(levels, summary) {
        const panel = document.getElementById('greeksPanel');
        if (!panel) return;
        panel.style.display = 'grid';

        const maxPainEl = document.getElementById('greekMaxPain');
        const pcrEl = document.getElementById('greekPCR');
        const pcrDescEl = document.getElementById('greekPCRDesc');
        const netDeltaEl = document.getElementById('greekNetDelta');
        const netVannaEl = document.getElementById('greekNetVanna');
        const netCharmEl = document.getElementById('greekNetCharm');
        const ivSkewEl = document.getElementById('greekIVSkew');
        const ivSkewDescEl = document.getElementById('greekIVSkewDesc');

        if (maxPainEl) maxPainEl.textContent = formatPrice(levels.maxPain);

        if (pcrEl && summary) {
            const pcr = summary.totalPutOI / (summary.totalCallOI || 1);
            pcrEl.textContent = pcr.toFixed(2);
            if (pcrDescEl) {
                pcrDescEl.textContent = pcr > 1.2 ? 'Bearish skew' : pcr < 0.8 ? 'Bullish skew' : 'Neutral';
            }
        }

        if (netDeltaEl) netDeltaEl.textContent = formatNumber(levels.netDEX);
        if (netVannaEl) netVannaEl.textContent = formatNumber(levels.totalVanna);
        if (netCharmEl) netCharmEl.textContent = formatNumber(levels.totalCharm);

        if (ivSkewEl) {
            ivSkewEl.textContent = (levels.ivSkew || 0).toFixed(2) + '%';
            if (ivSkewDescEl) {
                const skew = levels.ivSkew || 0;
                ivSkewDescEl.textContent = skew > 2 ? 'Fear premium (puts expensive)' : skew < -1 ? 'Call skew (bullish)' : 'Normal skew';
            }
        }
    }

    // ===== REGIME ANALYSIS =====
    function renderRegimeAnalysis(levels, quote) {
        const card = document.getElementById('analysisCard');
        const content = document.getElementById('analysisContent');
        if (!card || !content) return;
        card.style.display = 'block';

        const spot = quote.price;
        const inflection = levels.inflection;
        const distToInflection = spot - inflection;
        const distToCall = levels.callWall - spot;
        const distToPut = spot - levels.putWall;

        let html = '';

        if (levels.isPositiveGamma) {
            html += `<p><span class="highlight-green">Positive Gamma Zone:</span> Price ($${formatPrice(spot)}) is <strong>above</strong> the inflection point ($${formatPrice(inflection)}).</p>`;
            html += `<p>Market makers are <strong>net long gamma</strong> and will <span class="highlight-green">sell into rallies, buy into dips</span> — this is a <strong>stabilizing, mean-reverting</strong> regime.</p>`;
            html += `<p>The Call Wall at <span class="highlight-green">$${formatPrice(levels.callWall)}</span> (${distToCall > 0 ? '+' : ''}${formatPrice(distToCall)} away) acts as resistance where selling pressure may intensify.</p>`;
            html += `<p>The Put Wall at <span class="highlight-red">$${formatPrice(levels.putWall)}</span> (${distToPut > 0 ? '+' : ''}${formatPrice(distToPut)} below) acts as support where buying interest may emerge.</p>`;
            html += `<p><strong>Net DEX:</strong> ${formatNumber(levels.netDEX)} — ${levels.netDEX > 0 ? 'net long delta (bullish bias)' : 'net short delta (bearish bias)'}</p>`;
        } else {
            html += `<p><span class="highlight-red">Negative Gamma Zone:</span> Price ($${formatPrice(spot)}) is <strong>below</strong> the inflection point ($${formatPrice(inflection)}).</p>`;
            html += `<p>Market makers are <strong>net short gamma</strong> and will <span class="highlight-red">buy into rallies, sell into dips</span> — this is an <strong>amplifying, trending/volatile</strong> regime.</p>`;
            html += `<p>The inflection at <span class="highlight-yellow">$${formatPrice(inflection)}</span> (${distToInflection > 0 ? '+' : ''}${formatPrice(distToInflection)} above) is the key level to reclaim for stabilization.</p>`;
            html += `<p>Below the Put Wall at <span class="highlight-red">$${formatPrice(levels.putWall)}</span>, downside moves may accelerate as dealers are forced to sell into weakness.</p>`;
            html += `<p><strong>Net DEX:</strong> ${formatNumber(levels.netDEX)} — ${levels.netDEX > 0 ? 'net long delta (bullish bias despite negative gamma)' : 'net short delta (bearish bias amplified)'}</p>`;
        }

        html += `<p style="margin-top:12px;"><strong>Vanna:</strong> ${formatNumber(levels.totalVanna)} — ${Math.abs(levels.totalVanna) > 1000000 ? 'High vol sensitivity. IV moves will shift delta significantly.' : 'Moderate vol sensitivity.'}</p>`;
        html += `<p><strong>Charm:</strong> ${formatNumber(levels.totalCharm)} — ${Math.abs(levels.totalCharm) > 500000 ? 'Significant time decay. Delta hedges will shift rapidly into expiry.' : 'Normal time decay profile.'}</p>`;

        content.innerHTML = html;
    }

    // ===== LOADING =====
    function showLoading() {
        const overlay = document.getElementById('loadingOverlay');
        if (overlay) overlay.classList.add('active');
    }

    function hideLoading() {
        const overlay = document.getElementById('loadingOverlay');
        if (overlay) overlay.classList.remove('active');
    }

    // ===== CHART TITLE =====
    function updateChartTitle(ticker, expDate) {
        const tickerEl = document.getElementById('chartTicker');
        const expEl = document.getElementById('chartExp');
        if (tickerEl) tickerEl.textContent = ticker;
        if (expEl) expEl.textContent = expDate ? `(${formatDate(expDate)})` : '';
    }

    // ===== LAST UPDATE =====
    function updateLastUpdate() {
        const el = document.getElementById('lastUpdate');
        if (el) el.textContent = new Date().toLocaleTimeString();
    }

    // ===== GENERATE BUTTON =====
    function setGenerateEnabled(enabled) {
        const btn = document.getElementById('generateBtn');
        if (btn) btn.disabled = !enabled;
    }

    // ===== ERROR DISPLAY =====
    function showError(message, retryCallback) {
        const expList = document.getElementById('expList');
        if (!expList) return;

        expList.innerHTML = `
            <div class="error-msg">
                <span>⚠️</span>
                <div style="flex:1">
                    <div style="font-weight:700;">Error</div>
                    <div style="margin-top:4px;font-size:12px;">${message}</div>
                </div>
                ${retryCallback ? '<button onclick="' + retryCallback + '()">Retry</button>' : ''}
            </div>
        `;
    }

    // ===== INIT =====
    function init() {
        renderTickerGrid(TICKER_PRESETS.equity);

        // Mobile sidebar close on outside click
        document.addEventListener('click', (e) => {
            const sidebar = document.getElementById('sidebar');
            const toggle = document.getElementById('mobileNavToggle');
            if (sidebar && toggle && sidebarOpen && !sidebar.contains(e.target) && !toggle.contains(e.target)) {
                sidebarOpen = false;
                sidebar.classList.remove('open');
            }
        });

        // Enter key on search
        const input = document.getElementById('tickerInput');
        if (input) {
            input.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    if (window.app && window.app.searchTicker) {
                        window.app.searchTicker();
                    }
                }
            });
        }
    }

    // ===== PUBLIC API =====
    return {
        init,
        toggleSidebar,
        switchAssetClass,
        selectTicker,
        renderTickerGrid,
        renderExpirations,
        selectExp,
        renderKeyLevels,
        renderPriceBar,
        updateRegimeBadge,
        renderGreeksPanel,
        renderRegimeAnalysis,
        showLoading,
        hideLoading,
        updateChartTitle,
        updateLastUpdate,
        setGenerateEnabled,
        showError,
        formatDate,
        formatDaysLeft,
        formatPrice,
        formatNumber,
        formatPercent,
        TICKER_PRESETS
    };
})();

// Expose to window for HTML onclick handlers
window.ui = UIManager;
