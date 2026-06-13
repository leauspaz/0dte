#!/usr/bin/env python3
"""
0DTE GEX Analyzer - Python Desktop App
=====================================
A local web server that fetches Yahoo Finance options data and calculates
Gamma Exposure (GEX), Delta Exposure (DEX), Vanna, Charm, and more.

Usage:
    python main.py

Then open http://localhost:8080 in your browser.
"""

import os
import sys
import json
import math
import webbrowser
import threading
from datetime import datetime, timedelta
from dataclasses import dataclass, asdict
from typing import List, Dict, Optional, Tuple
from pathlib import Path

# Check dependencies
try:
    import yfinance as yf
    import numpy as np
    from scipy.stats import norm
except ImportError:
    print("Installing dependencies...")
    os.system(f"{sys.executable} -m pip install yfinance numpy scipy flask")
    print("Please restart the application.")
    sys.exit(0)

try:
    from flask import Flask, jsonify, request, send_from_directory
except ImportError:
    print("Installing Flask...")
    os.system(f"{sys.executable} -m pip install flask")
    from flask import Flask, jsonify, request, send_from_directory

# ============================================================================
# CONFIGURATION
# ============================================================================
PORT = 8080
HOST = "127.0.0.1"
RISK_FREE_RATE = 0.05  # 5%

# ============================================================================
# DATA MODELS
# ============================================================================

@dataclass
class Quote:
    price: float
    change: float
    change_percent: float
    symbol: str
    currency: str
    previous_close: float

@dataclass
class StrikeData:
    strike: float
    call_gex: float
    put_gex: float
    total_gex: float
    call_dex: float
    put_dex: float
    total_dex: float
    call_vanna: float
    put_vanna: float
    total_vanna: float
    call_charm: float
    put_charm: float
    total_charm: float
    call_theta: float
    put_theta: float
    total_theta: float
    call_vega: float
    put_vega: float
    total_vega: float
    call_oi: int
    put_oi: int
    total_oi: int
    call_vol: int
    put_vol: int
    total_vol: int
    call_iv: float
    put_iv: float
    avg_iv: float
    cumulative_gex: float = 0.0
    cumulative_dex: float = 0.0
    aggregate_gex: float = 0.0
    aggregate_dex: float = 0.0

@dataclass
class KeyLevels:
    call_wall: float
    put_wall: float
    inflection: float
    zero_gamma: float
    max_pain: float
    net_gex: float
    net_dex: float
    total_gex: float
    total_dex: float
    total_vanna: float
    total_charm: float
    is_positive_gamma: bool
    iv_skew: float
    spot_price: float = 0.0

@dataclass
class GreeksSummary:
    total_call_oi: int
    total_put_oi: int
    total_call_vol: int
    total_put_vol: int
    put_call_ratio: float

# ============================================================================
# UTILITY FUNCTIONS
# ============================================================================

def safe_float(value, default=0.0):
    """Convert value to float, handling NaN and None."""
    try:
        f = float(value)
        if math.isnan(f) or math.isinf(f):
            return default
        return f
    except (TypeError, ValueError):
        return default

def safe_int(value, default=0):
    """Convert value to int, handling NaN and None."""
    try:
        f = float(value)
        if math.isnan(f) or math.isinf(f):
            return default
        return int(f)
    except (TypeError, ValueError):
        return default

# ============================================================================
# BLACK-SCHOLES ENGINE
# ============================================================================

class GreekEngine:
    """Calculate option Greeks using Black-Scholes model."""

    @staticmethod
    def d1_d2(S: float, K: float, T: float, r: float, sigma: float) -> Tuple[float, float]:
        if T <= 0 or sigma <= 0 or S <= 0 or K <= 0:
            return 0.0, 0.0
        d1 = (math.log(S / K) + (r + 0.5 * sigma ** 2) * T) / (sigma * math.sqrt(T))
        d2 = d1 - sigma * math.sqrt(T)
        return d1, d2

    @staticmethod
    def delta(S: float, K: float, T: float, r: float, sigma: float, is_call: bool) -> float:
        d1, _ = GreekEngine.d1_d2(S, K, T, r, sigma)
        if is_call:
            return norm.cdf(d1)
        return norm.cdf(d1) - 1

    @staticmethod
    def gamma(S: float, K: float, T: float, r: float, sigma: float) -> float:
        d1, _ = GreekEngine.d1_d2(S, K, T, r, sigma)
        return norm.pdf(d1) / (S * sigma * math.sqrt(T))

    @staticmethod
    def vega(S: float, K: float, T: float, r: float, sigma: float) -> float:
        d1, _ = GreekEngine.d1_d2(S, K, T, r, sigma)
        return S * norm.pdf(d1) * math.sqrt(T) / 100

    @staticmethod
    def theta(S: float, K: float, T: float, r: float, sigma: float, is_call: bool) -> float:
        d1, d2 = GreekEngine.d1_d2(S, K, T, r, sigma)
        nd1 = norm.pdf(d1)
        term1 = -(S * nd1 * sigma) / (2 * math.sqrt(T))
        if is_call:
            return (term1 - r * K * math.exp(-r * T) * norm.cdf(d2)) / 365
        return (term1 + r * K * math.exp(-r * T) * norm.cdf(-d2)) / 365

    @staticmethod
    def vanna(S: float, K: float, T: float, r: float, sigma: float) -> float:
        d1, d2 = GreekEngine.d1_d2(S, K, T, r, sigma)
        return -norm.pdf(d1) * d2 / (sigma * 100)

    @staticmethod
    def charm(S: float, K: float, T: float, r: float, sigma: float, is_call: bool) -> float:
        d1, d2 = GreekEngine.d1_d2(S, K, T, r, sigma)
        nd1 = norm.pdf(d1)
        term1 = (2 * r * T - d2 * sigma * math.sqrt(T)) / (2 * T * sigma * math.sqrt(T))
        term2 = r * norm.cdf(d1)
        if is_call:
            return (nd1 * term1 - term2) / 365
        return (nd1 * term1 - r * (norm.cdf(d1) - 1)) / 365

# ============================================================================
# YAHOO FINANCE CLIENT
# ============================================================================

class YahooClient:
    """Fetch options data from Yahoo Finance using yfinance."""

    @staticmethod
    def get_quote(ticker: str) -> Quote:
        """Get current stock quote."""
        stock = yf.Ticker(ticker)
        info = stock.info

        price = safe_float(info.get('regularMarketPrice', info.get('currentPrice', 0)))
        prev_close = safe_float(info.get('regularMarketPreviousClose', info.get('previousClose', price)))
        change = price - prev_close
        change_pct = (change / prev_close * 100) if prev_close else 0

        return Quote(
            price=price,
            change=change,
            change_percent=change_pct,
            symbol=ticker.upper(),
            currency=info.get('currency', 'USD'),
            previous_close=prev_close
        )

    @staticmethod
    def get_expirations(ticker: str) -> List[str]:
        """Get available option expiration dates."""
        stock = yf.Ticker(ticker)
        try:
            return list(stock.options)
        except Exception:
            return []

    @staticmethod
    def get_options_chain(ticker: str, expiration: str) -> Tuple[Optional[object], Optional[object]]:
        """Get calls and puts for a specific expiration."""
        stock = yf.Ticker(ticker)
        try:
            chain = stock.option_chain(expiration)
            return chain.calls, chain.puts
        except Exception as e:
            print(f"Error fetching options for {ticker} {expiration}: {e}")
            return None, None

# ============================================================================
# GEX CALCULATOR
# ============================================================================

class GEXCalculator:
    """Calculate Gamma Exposure and other Greeks from options chain."""

    def __init__(self, spot_price: float, risk_free_rate: float = RISK_FREE_RATE):
        self.S = spot_price
        self.r = risk_free_rate
        self.engine = GreekEngine()

    def calculate(self, calls_df, puts_df, expiration_date: datetime) -> Tuple[List[StrikeData], GreeksSummary]:
        """Calculate all Greeks for every strike."""
        T = max((expiration_date - datetime.now()).days / 365.25, 0.001)

        # Build strike map
        strikes = {}

        # Process calls
        total_call_oi = 0
        total_call_vol = 0
        for _, row in calls_df.iterrows():
            strike = safe_float(row['strike'])
            if strike <= 0:
                continue
            if strike not in strikes:
                strikes[strike] = {'call': None, 'put': None}
            strikes[strike]['call'] = row
            total_call_oi += safe_int(row.get('openInterest', 0))
            total_call_vol += safe_int(row.get('volume', 0))

        # Process puts
        total_put_oi = 0
        total_put_vol = 0
        for _, row in puts_df.iterrows():
            strike = safe_float(row['strike'])
            if strike <= 0:
                continue
            if strike not in strikes:
                strikes[strike] = {'call': None, 'put': None}
            strikes[strike]['put'] = row
            total_put_oi += safe_int(row.get('openInterest', 0))
            total_put_vol += safe_int(row.get('volume', 0))

        # Calculate Greeks per strike
        sorted_strikes = sorted(strikes.keys())
        results = []

        for strike in sorted_strikes:
            data = strikes[strike]

            # Call calculations
            call_gex = call_dex = call_vanna = call_charm = call_theta = call_vega = 0.0
            call_oi = call_vol = 0
            call_iv = 0.0

            if data['call'] is not None:
                row = data['call']
                iv = safe_float(row.get('impliedVolatility', 0.25), 0.25)
                if iv <= 0:
                    iv = 0.25
                oi = safe_int(row.get('openInterest', 0))
                vol = safe_int(row.get('volume', 0))
                call_oi = oi
                call_vol = vol
                call_iv = iv

                g = self.engine.gamma(self.S, strike, T, self.r, iv)
                d = self.engine.delta(self.S, strike, T, self.r, iv, True)
                v = self.engine.vanna(self.S, strike, T, self.r, iv)
                c = self.engine.charm(self.S, strike, T, self.r, iv, True)
                t = self.engine.theta(self.S, strike, T, self.r, iv, True)
                ve = self.engine.vega(self.S, strike, T, self.r, iv)

                call_gex = g * oi * self.S * 100
                call_dex = d * oi * 100
                call_vanna = v * oi * 100
                call_charm = c * oi * 100
                call_theta = t * oi * 100
                call_vega = ve * oi * 100

            # Put calculations
            put_gex = put_dex = put_vanna = put_charm = put_theta = put_vega = 0.0
            put_oi = put_vol = 0
            put_iv = 0.0

            if data['put'] is not None:
                row = data['put']
                iv = safe_float(row.get('impliedVolatility', 0.25), 0.25)
                if iv <= 0:
                    iv = 0.25
                oi = safe_int(row.get('openInterest', 0))
                vol = safe_int(row.get('volume', 0))
                put_oi = oi
                put_vol = vol
                put_iv = iv

                g = self.engine.gamma(self.S, strike, T, self.r, iv)
                d = self.engine.delta(self.S, strike, T, self.r, iv, False)
                v = self.engine.vanna(self.S, strike, T, self.r, iv)
                c = self.engine.charm(self.S, strike, T, self.r, iv, False)
                t = self.engine.theta(self.S, strike, T, self.r, iv, False)
                ve = self.engine.vega(self.S, strike, T, self.r, iv)

                put_gex = -g * oi * self.S * 100
                put_dex = d * oi * 100
                put_vanna = -v * oi * 100
                put_charm = c * oi * 100
                put_theta = t * oi * 100
                put_vega = ve * oi * 100

            results.append(StrikeData(
                strike=strike,
                call_gex=call_gex,
                put_gex=put_gex,
                total_gex=call_gex + put_gex,
                call_dex=call_dex,
                put_dex=put_dex,
                total_dex=call_dex + put_dex,
                call_vanna=call_vanna,
                put_vanna=put_vanna,
                total_vanna=call_vanna + put_vanna,
                call_charm=call_charm,
                put_charm=put_charm,
                total_charm=call_charm + put_charm,
                call_theta=call_theta,
                put_theta=put_theta,
                total_theta=call_theta + put_charm,
                call_vega=call_vega,
                put_vega=put_vega,
                total_vega=call_vega + put_vega,
                call_oi=call_oi,
                put_oi=put_oi,
                total_oi=call_oi + put_oi,
                call_vol=call_vol,
                put_vol=put_vol,
                total_vol=call_vol + put_vol,
                call_iv=call_iv,
                put_iv=put_iv,
                avg_iv=(call_iv + put_iv) / 2 if call_iv or put_iv else 0
            ))

        # Calculate cumulative GEX and DEX
        cum_gex = 0.0
        cum_dex = 0.0
        for item in results:
            cum_gex += item.total_gex
            cum_dex += item.total_dex
            item.cumulative_gex = cum_gex
            item.cumulative_dex = cum_dex

        # Calculate aggregate GEX (recalculate as if each strike were spot)
        for item in results:
            agg_gex = 0.0
            agg_dex = 0.0
            for other in results:
                if other.call_oi > 0:
                    iv = other.call_iv or 0.25
                    g = self.engine.gamma(item.strike, other.strike, T, self.r, iv)
                    agg_gex += g * other.call_oi * item.strike * 100
                if other.put_oi > 0:
                    iv = other.put_iv or 0.25
                    g = self.engine.gamma(item.strike, other.strike, T, self.r, iv)
                    agg_gex -= g * other.put_oi * item.strike * 100
            item.aggregate_gex = agg_gex
            item.aggregate_dex = agg_dex

        summary = GreeksSummary(
            total_call_oi=total_call_oi,
            total_put_oi=total_put_oi,
            total_call_vol=total_call_vol,
            total_put_vol=total_put_vol,
            put_call_ratio=total_put_oi / max(total_call_oi, 1)
        )

        return results, summary

# ============================================================================
# KEY LEVELS FINDER
# ============================================================================

class KeyLevelsFinder:
    """Find important levels from GEX data."""

    @staticmethod
    def find(data: List[StrikeData], spot_price: float) -> KeyLevels:
        if not data:
            return KeyLevels(
                call_wall=0, put_wall=0, inflection=0, zero_gamma=0, max_pain=0,
                net_gex=0, net_dex=0, total_gex=0, total_dex=0,
                total_vanna=0, total_charm=0, is_positive_gamma=False, iv_skew=0
            )

        # Call wall: highest positive total GEX
        call_wall = max(data, key=lambda x: x.total_gex).strike

        # Put wall: most negative total GEX
        put_wall = min(data, key=lambda x: x.total_gex).strike

        # Zero gamma: total GEX closest to zero
        zero_gamma = min(data, key=lambda x: abs(x.total_gex)).strike

        # Inflection: cumulative GEX crosses zero
        inflection = None
        prev_cum = data[0].cumulative_gex
        for item in data[1:]:
            if (prev_cum < 0 and item.cumulative_gex >= 0) or (prev_cum >= 0 and item.cumulative_gex < 0):
                inflection = item.strike
                break
            prev_cum = item.cumulative_gex

        if inflection is None:
            inflection = min(data, key=lambda x: abs(x.cumulative_gex)).strike

        # Max pain
        max_pain = None
        min_pain = float('inf')
        for item in data:
            pain = 0
            for other in data:
                if other.call_oi > 0 and other.strike > item.strike:
                    pain += other.call_oi * (other.strike - item.strike)
                if other.put_oi > 0 and other.strike < item.strike:
                    pain += other.put_oi * (item.strike - other.strike)
            if pain < min_pain:
                min_pain = pain
                max_pain = item.strike

        # Net GEX at spot
        net_gex = 0.0
        net_dex = 0.0
        for item in data:
            if item.strike >= spot_price:
                net_gex = item.cumulative_gex
                net_dex = item.cumulative_dex
                break

        total_gex = sum(item.total_gex for item in data)
        total_dex = sum(item.total_dex for item in data)
        total_vanna = sum(item.total_vanna for item in data)
        total_charm = sum(item.total_charm for item in data)

        # IV skew
        atm_item = min(data, key=lambda x: abs(x.strike - spot_price))
        iv_skew = (atm_item.put_iv - atm_item.call_iv) * 100

        return KeyLevels(
            call_wall=call_wall,
            put_wall=put_wall,
            inflection=inflection,
            zero_gamma=zero_gamma,
            max_pain=max_pain,
            net_gex=net_gex,
            net_dex=net_dex,
            total_gex=total_gex,
            total_dex=total_dex,
            total_vanna=total_vanna,
            total_charm=total_charm,
            is_positive_gamma=spot_price > inflection,
            iv_skew=iv_skew,
            spot_price=spot_price
        )

# ============================================================================
# FLASK APP
# ============================================================================

app = Flask(__name__, static_folder='static')

@app.route('/')
def index():
    return send_from_directory('.', 'index.html')

@app.route('/<path:path>')
def static_files(path):
    return send_from_directory('.', path)

@app.route('/api/quote/<ticker>')
def api_quote(ticker):
    try:
        # yfinance uses ^ prefix for indices (e.g., ^SPX, ^NDX)
        # Pass ticker as-is
        quote = YahooClient.get_quote(ticker)
        return jsonify(asdict(quote))
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/expirations/<ticker>')
def api_expirations(ticker):
    try:
        exps = YahooClient.get_expirations(ticker)
        return jsonify({'expirations': exps})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/gex/<ticker>')
def api_gex(ticker):
    expiration = request.args.get('expiration')
    if not expiration:
        return jsonify({'error': 'Missing expiration parameter'}), 400

    try:
        # Get quote
        quote = YahooClient.get_quote(ticker)

        # Get options chain
        calls, puts = YahooClient.get_options_chain(ticker, expiration)
        if calls is None or puts is None:
            # Check if ticker is an unsupported type
            unsupported_prefixes = ('ES=', 'NQ=', 'YM=', 'RTY=', 'GC=', 'SI=', 'CL=', 'NG=', 'ZB=', 'ZN=', 'ZW=', 'ZC=', 'ZS=', 'KC=', 'CT=', 'CC=', 'SB=', 'HG=', 'PA=', 'PL=', 'BTC-', 'ETH-', 'SOL-', 'XRP-', 'ADA-', 'DOGE-', 'EURUSD=', 'GBPUSD=', 'USDJPY=', 'AUDUSD=')
            is_unsupported = ticker.upper().startswith(unsupported_prefixes)
            if is_unsupported:
                return jsonify({'error': f'{ticker} does not have options data on Yahoo Finance. Only individual stocks and ETFs are supported for GEX analysis. Try SPY, QQQ, TSLA, NVDA, AAPL, etc.'}), 404
            return jsonify({'error': 'No options data available for this ticker. It may not have options, or Yahoo Finance may be temporarily unavailable.'}), 404

        # Calculate Greeks
        calc = GEXCalculator(quote.price)
        exp_date = datetime.strptime(expiration, '%Y-%m-%d')
        results, summary = calc.calculate(calls, puts, exp_date)

        # Find key levels
        levels = KeyLevelsFinder.find(results, quote.price)

        # Convert to dicts for JSON
        data_dicts = [asdict(item) for item in results]
        levels_dict = asdict(levels)
        summary_dict = asdict(summary)
        quote_dict = asdict(quote)

        return jsonify({
            'data': data_dicts,
            'levels': levels_dict,
            'summary': summary_dict,
            'quote': quote_dict,
            'expiration': expiration
        })

    except Exception as e:
        import traceback
        return jsonify({'error': str(e), 'traceback': traceback.format_exc()}), 500

# ============================================================================
# MAIN
# ============================================================================

def open_browser():
    """Open browser after server starts."""
    import time
    time.sleep(1.5)
    webbrowser.open(f'http://{HOST}:{PORT}')

if __name__ == '__main__':
    print("=" * 60)
    print("  0DTE GEX Analyzer - Python Desktop App")
    print("=" * 60)
    print(f"\n  Starting server at http://{HOST}:{PORT}")
    print("  Opening browser automatically...\n")

    # Open browser in background thread
    threading.Thread(target=open_browser, daemon=True).start()

    # Run Flask server
    app.run(host=HOST, port=PORT, debug=False, threaded=True)
