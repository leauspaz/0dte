# Greek Analyzer

A free, client-side Greeks dashboard built for options traders. No API keys, no backend, no payments.

Hosted on **GitHub Pages**. All data comes from Yahoo Finance (delayed 15–30 minutes).

---

## What It Does

This tool calculates and visualizes:

| Metric | What It Shows |
|--------|---------------|
| **GEX (Gamma Exposure)** | Per-strike gamma × open interest. Shows where dealers are hedged. |
| **DEX (Delta Exposure)** | Per-strike delta × open interest. Shows net directional bias. |
| **Vanna** | How delta changes with implied volatility. Critical around events. |
| **Charm** | How delta decays over time. Key into expiry. |
| **OI Profile** | Open interest by strike. Where liquidity sits. |
| **IV Skew** | Put vs Call implied volatility. Fear/greed positioning. |
| **Max Pain** | Strike where most options expire worthless. Weekly pin target. |
| **Put/Call Ratio** | Open interest ratio. Sentiment gauge. |

---

## Key Levels Explained

### Call Wall

The strike with the **highest positive GEX**. Acts as **resistance** because dealers are long gamma there and will sell into rallies above it.

### Put Wall

The strike with the **most negative GEX**. Acts as **support** because dealers are long puts (short gamma) and will buy into dips below it.

### Gamma Inflection Point

The strike where **cumulative GEX crosses zero**. Above = positive gamma (stabilizing). Below = negative gamma (amplifying). This is the most important level for regime identification.

### Zero Gamma

The individual strike where **total GEX is closest to zero**. Less significant than the inflection point but useful for pinpointing neutral zones.

### Max Pain

The strike where the **total dollar value of all ITM options is minimized**. Market has an incentive to pin here at expiry.

---

## How to Use It

### 1. Search a Ticker

Type any ticker with options (e.g., `SPY`, `TSLA`, `QQQ`) and hit Enter or click Search.

### 2. Select an Expiration

Choose from available expiration dates. The nearest expiration usually has the most meaningful GEX.

### 3. Click "Generate GEX"

The tool fetches options data and calculates all Greeks.

### 4. Read the Regime

Look at the **Gamma Zone** badge:

- **Positive Gamma** (green): Stabilizing regime. Expect mean-reversion, range-bound price action.
- **Negative Gamma** (red): Amplifying regime. Expect trending, volatile, fast moves.

### 5. Interpret the Chart

- **Green bars** = Call GEX (positive, resistance-building)
- **Red bars** = Put GEX (negative, support-building)
- **Purple line** = Aggregate GEX (recalculated as if each strike were spot)
- **Yellow line** = Cumulative Net GEX (running total from lowest strike)

### 6. Toggle Series

Click the buttons above the chart to switch between:

- **GEX** — Gamma exposure (default)
- **DEX** — Delta exposure (directional bias)
- **Vanna** — Vol sensitivity of delta
- **Charm** — Time decay of delta
- **OI** — Open interest profile
- **IV Skew** — Implied volatility skew

---

## Trading Applications (SMC Context)

### Positive Gamma Zone

- Price tends to **pin to strikes** with high GEX
- **FVGs** above/below may not fill quickly
- **Order blocks** near Call/Put Walls are high-probability
- Range trading, iron condors, straddles work well

### Negative Gamma Zone

- Price **moves fast** through empty strike zones
- **FVGs** are more likely to fill
- **Breaker blocks** and **mitigation blocks** have higher follow-through
- Trend following, breakouts, momentum trades work better
- Wider stops needed

### Confluence with ICT Concepts

| SMC Concept | GEX/DEX Equivalent |
|-------------|-------------------|
| Fair Value Gap | Empty GEX zone between walls = fast move zone |
| Order Block | DEX flip zone = dealer hedge reversal |
| Breaker | Call/Put Wall = high probability reversal |
| Liquidity Void | Low OI/GEX strikes = no support/resistance |
| Killzone | High Vanna near events = explosive potential |
| Judas Swing | Pre-expiry Charm flip = forced hedge adjustment |

---

## Asset Coverage

### Works Well (Robust Options Data)

- **Equities**: SPY, QQQ, IWM, TSLA, NVDA, AAPL, META, AMZN, GOOGL, MSFT, AMD, COIN, NFLX, PLTR, HOOD, MSTR, SMCI, AVGO
- **ETFs**: SPY, QQQ, IWM, DIA, XLF, XLK, XLE, XLU, XLI, XLP, XLB, XRT, XHB, KRE, SMH, SOXX, IBB, XBI, ARKK, TLT

### Limited / May Fail (Thin Options Data)

- **Futures**: ES=F, NQ=F, YM=F, GC=F, SI=F, CL=F — futures options are thinner on Yahoo
- **Crypto**: BTC-USD, ETH-USD — **no options chains** on Yahoo
- **FX**: EURUSD=X, GBPUSD=X — **no options chains** on Yahoo
- **Commodities**: GC=F, SI=F, CL=F, NG=F — limited options data

For futures, crypto, and FX tickers that fail, the tool will show an error. Try an equity or equity ETF instead.

---

## Data Source & Limitations

| Aspect | Detail |
|--------|--------|
| **Source** | Yahoo Finance (free, no API key) |
| **Delay** | 15–30 minutes |
| **Rate limit** | ~360 requests/hour per IP. The tool adds 1.5s delays between requests. |
| **Historical** | Not available. Only current snapshot. |
| **Accuracy** | Uses Black-Scholes model. Real market makers may use different models. |
| **Contract multiplier** | Assumes 100 shares per contract (US equities). |

---
