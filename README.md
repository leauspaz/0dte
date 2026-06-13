# 0dte GEX Analyzer — Python Desktop App

A free, local Gamma Exposure (GEX) dashboard for options traders. Runs entirely on your computer — no API keys, no hosting, no CORS issues.

## What It Does

Calculates and visualizes:

| Metric | Description |
|--------|-------------|
| **GEX** | Gamma Exposure per strike — where dealers are hedged |
| **DEX** | Delta Exposure — net directional bias |
| **Vanna** | How delta changes with IV — critical around events |
| **Charm** | Delta decay over time — key into expiry |
| **OI Profile** | Open interest by strike — liquidity map |
| **IV Skew** | Put vs Call IV — fear/greed positioning |
| **Max Pain** | Weekly pin target |
| **Put/Call Ratio** | Sentiment gauge |

## Quick Start

### 1. Install Dependencies

```bash
pip install -r requirements.txt
```

Or install individually:
```bash
pip install flask yfinance numpy scipy pandas
```

### 2. Run the Server

```bash
python main.py
```

The server starts at `http://127.0.0.1:8080` and opens automatically in your browser.

### 3. Use the App

- Type a ticker (e.g., `SPY`, `TSLA`, `QQQ`)
- Select an expiration date
- Click **Generate GEX**
- Toggle between GEX, DEX, Vanna, Charm, OI, IV Skew views

## Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Your Browser   │────▶│  Flask Server   │────▶│  Yahoo Finance  │
│  (localhost)    │◄────│  (Python)       │◄────│  (your home IP) │
└─────────────────┘     └─────────────────┘     └─────────────────┘
        │                        │
        │                        ├── Black-Scholes calculations
        │                        ├── GEX/DEX/Vanna/Charm
        │                        └── Key levels finder
        │
        └── Chart.js rendering
```

**Why this works**: Your home IP isn't blocked by Yahoo. No CORS. No proxies. No rate limits.

## File Structure

| File | Purpose |
|------|---------|
| `main.py` | Flask server, Yahoo client, Black-Scholes engine |
| `index.html` | Frontend UI (same layout as before) |
| `styles.css` | Dark theme, mobile responsive |
| `api-client.js` | Fetches from local Flask API |
| `chart-builder.js` | Chart.js multi-dataset rendering |
| `ui-manager.js` | DOM updates, mobile nav, events |
| `app.js` | Main app logic |
| `requirements.txt` | Python dependencies |

## Key Levels Explained

| Level | Meaning |
|-------|---------|
| **Call Wall** | Strike with highest positive GEX — resistance |
| **Put Wall** | Strike with most negative GEX — support |
| **Gamma Inflection** | Where cumulative GEX crosses zero — regime change |
| **Zero Gamma** | Individual strike closest to zero GEX |
| **Max Pain** | Where most options expire worthless — pin target |

## Trading Applications (ICT Context)

### Positive Gamma Zone (above inflection)
- Price pins to strikes — range-bound
- FVGs fill slowly
- Order blocks near walls are high-probability
- Range trades, iron condors work well

### Negative Gamma Zone (below inflection)
- Price moves fast through empty zones
- FVGs fill quickly
- Breaker blocks have follow-through
- Trend/momentum trades work better
- Wider stops needed

## Asset Coverage

Works with any ticker that has options on Yahoo Finance:
- **Equities**: SPY, QQQ, IWM, TSLA, NVDA, AAPL, META, AMZN, etc.
- **ETFs**: SPY, QQQ, IWM, DIA, XLF, XLK, XLE, etc.
- **Futures**: ES=F, NQ=F (limited data on Yahoo)
- **Crypto/FX**: No options data on Yahoo

## Data Limitations

| Aspect | Detail |
|--------|--------|
| **Source** | Yahoo Finance (via yfinance) |
| **Delay** | 15–30 minutes |
| **Rate limit** | None — runs from your IP |
| **Historical** | Not available (current snapshot only) |
| **Accuracy** | Black-Scholes model — real market makers may differ |

## Troubleshooting

| Problem | Solution |
|---------|----------|
| `ModuleNotFoundError` | Run `pip install -r requirements.txt` |
| `yfinance` errors | Update: `pip install -U yfinance` |
| Port 8080 in use | Edit `main.py`, change `PORT = 8080` |
| Browser doesn't open | Manually go to `http://127.0.0.1:8080` |
| No options data | Ticker may not have options. Try `SPY` or `QQQ`. |

## Disclaimer

For educational purposes only. Not financial advice. Options data is delayed. Always verify with your broker before trading.

## License

MIT License. Free to use, modify, and distribute.
