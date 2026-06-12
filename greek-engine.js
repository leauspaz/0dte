/* ===== GREEK ENGINE =====
 * Black-Scholes calculations for Gamma, Delta, Vanna, Charm, Theta, Vega
 * All calculations run client-side, no server needed
 */

const GreekEngine = (function() {
    'use strict';

    // ===== MATH UTILITIES =====

    function erf(x) {
        const sign = x >= 0 ? 1 : -1;
        x = Math.abs(x);
        const a1 =  0.254829592;
        const a2 = -0.284496736;
        const a3 =  1.421413741;
        const a4 = -1.453152027;
        const a5 =  1.061405429;
        const p  =  0.3275911;
        const t = 1.0 / (1.0 + p * x);
        const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
        return sign * y;
    }

    function normalCDF(x) {
        return 0.5 * (1 + erf(x / Math.sqrt(2)));
    }

    function normalPDF(x) {
        return Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);
    }

    // ===== BLACK-SCHOLES GREEKS =====

    function d1d2(S, K, T, r, sigma) {
        if (T <= 0 || sigma <= 0 || S <= 0 || K <= 0) return null;
        const d1 = (Math.log(S / K) + (r + 0.5 * sigma * sigma) * T) / (sigma * Math.sqrt(T));
        const d2 = d1 - sigma * Math.sqrt(T);
        return { d1, d2 };
    }

    // Delta: rate of change of option price w.r.t. underlying price
    function delta(S, K, T, r, sigma, isCall) {
        const d = d1d2(S, K, T, r, sigma);
        if (!d) return 0;
        if (isCall) {
            return normalCDF(d.d1);
        } else {
            return normalCDF(d.d1) - 1;
        }
    }

    // Gamma: rate of change of delta w.r.t. underlying price
    function gamma(S, K, T, r, sigma) {
        const d = d1d2(S, K, T, r, sigma);
        if (!d) return 0;
        return normalPDF(d.d1) / (S * sigma * Math.sqrt(T));
    }

    // Vega: sensitivity to implied volatility (per 1% change)
    function vega(S, K, T, r, sigma) {
        const d = d1d2(S, K, T, r, sigma);
        if (!d) return 0;
        return S * normalPDF(d.d1) * Math.sqrt(T) / 100;
    }

    // Theta: time decay (per day)
    function theta(S, K, T, r, sigma, isCall) {
        const d = d1d2(S, K, T, r, sigma);
        if (!d) return 0;
        const nd1 = normalPDF(d.d1);
        const nd2 = normalPDF(d.d2);
        const term1 = -(S * nd1 * sigma) / (2 * Math.sqrt(T));
        if (isCall) {
            return (term1 - r * K * Math.exp(-r * T) * normalCDF(d.d2)) / 365;
        } else {
            return (term1 + r * K * Math.exp(-r * T) * normalCDF(-d.d2)) / 365;
        }
    }

    // Vanna: dDelta/dVol — how delta changes with IV
    function vanna(S, K, T, r, sigma) {
        const d = d1d2(S, K, T, r, sigma);
        if (!d) return 0;
        return -normalPDF(d.d1) * d.d2 / (sigma * 100); // per 1% vol change
    }

    // Charm: dDelta/dTime — delta decay over time
    function charm(S, K, T, r, sigma, isCall) {
        const d = d1d2(S, K, T, r, sigma);
        if (!d) return 0;
        const nd1 = normalPDF(d.d1);
        const term1 = (2 * r * T - d.d2 * sigma * Math.sqrt(T)) / (2 * T * sigma * Math.sqrt(T));
        const term2 = r * normalCDF(d.d1);
        if (isCall) {
            return (nd1 * term1 - term2) / 365;
        } else {
            return (nd1 * term1 - r * (normalCDF(d.d1) - 1)) / 365;
        }
    }

    // ===== EXPOSURE CALCULATIONS =====

    function calculateAllGreeks(optionsData, spotPrice) {
        const options = optionsData.options[0];
        const calls = options.calls || [];
        const puts = options.puts || [];

        // Get expiration for T calculation
        const expDate = optionsData.options[0].expirationDate;
        const T = Math.max((expDate - Date.now() / 1000) / (365.25 * 24 * 3600), 0.001);
        const r = 0.05; // Risk-free rate (5%)

        // Build strike map
        const strikeMap = new Map();

        for (const call of calls) {
            const strike = call.strike;
            if (!strikeMap.has(strike)) {
                strikeMap.set(strike, { call: null, put: null });
            }
            strikeMap.get(strike).call = call;
        }

        for (const put of puts) {
            const strike = put.strike;
            if (!strikeMap.has(strike)) {
                strikeMap.set(strike, { call: null, put: null });
            }
            strikeMap.get(strike).put = put;
        }

        const strikes = Array.from(strikeMap.keys()).sort((a, b) => a - b);
        const results = [];

        let totalCallOI = 0, totalPutOI = 0;
        let totalCallVol = 0, totalPutVol = 0;

        for (const strike of strikes) {
            const data = strikeMap.get(strike);

            let callGEX = 0, callDEX = 0, callVanna = 0, callCharm = 0;
            let callTheta = 0, callVega = 0;
            let putGEX = 0, putDEX = 0, putVanna = 0, putCharm = 0;
            let putTheta = 0, putVega = 0;
            let callOI = 0, putOI = 0, callVol = 0, putVol = 0;
            let callIV = 0, putIV = 0;

            if (data.call) {
                const iv = data.call.impliedVolatility || 0.25;
                const oi = data.call.openInterest || 0;
                const vol = data.call.volume || 0;
                callOI = oi;
                callVol = vol;
                callIV = iv;
                totalCallOI += oi;
                totalCallVol += vol;

                const g = gamma(spotPrice, strike, T, r, iv);
                const d = delta(spotPrice, strike, T, r, iv, true);
                const v = vanna(spotPrice, strike, T, r, iv);
                const c = charm(spotPrice, strike, T, r, iv, true);
                const t = theta(spotPrice, strike, T, r, iv, true);
                const ve = vega(spotPrice, strike, T, r, iv);

                // GEX = gamma * OI * spot * 100 (contract multiplier)
                callGEX = g * oi * spotPrice * 100;
                // DEX = delta * OI * 100
                callDEX = d * oi * 100;
                callVanna = v * oi * 100;
                callCharm = c * oi * 100;
                callTheta = t * oi * 100;
                callVega = ve * oi * 100;
            }

            if (data.put) {
                const iv = data.put.impliedVolatility || 0.25;
                const oi = data.put.openInterest || 0;
                const vol = data.put.volume || 0;
                putOI = oi;
                putVol = vol;
                putIV = iv;
                totalPutOI += oi;
                totalPutVol += vol;

                const g = gamma(spotPrice, strike, T, r, iv);
                const d = delta(spotPrice, strike, T, r, iv, false);
                const v = vanna(spotPrice, strike, T, r, iv);
                const c = charm(spotPrice, strike, T, r, iv, false);
                const t = theta(spotPrice, strike, T, r, iv, false);
                const ve = vega(spotPrice, strike, T, r, iv);

                // Put GEX is negative (puts have negative gamma exposure)
                putGEX = -g * oi * spotPrice * 100;
                putDEX = d * oi * 100; // put delta is already negative
                putVanna = -v * oi * 100; // negative vanna for puts
                putCharm = c * oi * 100;
                putTheta = t * oi * 100;
                putVega = ve * oi * 100;
            }

            results.push({
                strike: strike,
                callGEX: callGEX,
                putGEX: putGEX,
                totalGEX: callGEX + putGEX,
                callDEX: callDEX,
                putDEX: putDEX,
                totalDEX: callDEX + putDEX,
                callVanna: callVanna,
                putVanna: putVanna,
                totalVanna: callVanna + putVanna,
                callCharm: callCharm,
                putCharm: putCharm,
                totalCharm: callCharm + putCharm,
                callTheta: callTheta,
                putTheta: putTheta,
                totalTheta: callTheta + putTheta,
                callVega: callVega,
                putVega: putVega,
                totalVega: callVega + putVega,
                callOI: callOI,
                putOI: putOI,
                totalOI: callOI + putOI,
                callVol: callVol,
                putVol: putVol,
                totalVol: callVol + putVol,
                callIV: callIV,
                putIV: putIV,
                avgIV: (callIV + putIV) / 2
            });
        }

        // Calculate cumulative GEX (from lowest strike upward)
        let cumulativeGEX = 0;
        for (const item of results) {
            cumulativeGEX += item.totalGEX;
            item.cumulativeGEX = cumulativeGEX;
        }

        // Calculate cumulative DEX
        let cumulativeDEX = 0;
        for (const item of results) {
            cumulativeDEX += item.totalDEX;
            item.cumulativeDEX = cumulativeDEX;
        }

        // Calculate aggregate GEX (recalculate as if each strike were spot)
        for (const item of results) {
            let aggGEX = 0;
            for (const other of results) {
                if (other.callOI > 0) {
                    const iv = other.callIV || 0.25;
                    const g = gamma(item.strike, other.strike, T, r, iv);
                    aggGEX += g * other.callOI * item.strike * 100;
                }
                if (other.putOI > 0) {
                    const iv = other.putIV || 0.25;
                    const g = gamma(item.strike, other.strike, T, r, iv);
                    aggGEX -= g * other.putOI * item.strike * 100;
                }
            }
            item.aggregateGEX = aggGEX;
        }

        // Calculate aggregate DEX
        for (const item of results) {
            let aggDEX = 0;
            for (const other of results) {
                if (other.callOI > 0) {
                    const iv = other.callIV || 0.25;
                    const d = delta(item.strike, other.strike, T, r, iv, true);
                    aggDEX += d * other.callOI * 100;
                }
                if (other.putOI > 0) {
                    const iv = other.putIV || 0.25;
                    const d = delta(item.strike, other.strike, T, r, iv, false);
                    aggDEX += d * other.putOI * 100;
                }
            }
            item.aggregateDEX = aggDEX;
        }

        return {
            data: results,
            summary: {
                totalCallOI,
                totalPutOI,
                totalCallVol,
                totalPutVol,
                T
            }
        };
    }

    // ===== KEY LEVELS =====

    function findKeyLevels(results, spotPrice) {
        // Call Wall: highest positive total GEX
        let callWall = null, maxCallGEX = -Infinity;
        // Put Wall: most negative total GEX
        let putWall = null, minPutGEX = Infinity;
        // Max Pain: strike where total ITM value is minimized
        let maxPain = null, minPain = Infinity;
        // Zero gamma: total GEX closest to zero
        let zeroGamma = null, minAbsGEX = Infinity;
        // Inflection: cumulative GEX crosses zero
        let inflection = null;

        for (const item of results) {
            if (item.totalGEX > maxCallGEX) {
                maxCallGEX = item.totalGEX;
                callWall = item.strike;
            }
            if (item.totalGEX < minPutGEX) {
                minPutGEX = item.totalGEX;
                putWall = item.strike;
            }
            if (Math.abs(item.totalGEX) < minAbsGEX) {
                minAbsGEX = Math.abs(item.totalGEX);
                zeroGamma = item.strike;
            }
        }

        // Find inflection point (cumulative GEX crosses zero)
        let prevCum = results[0].cumulativeGEX;
        for (let i = 1; i < results.length; i++) {
            const currCum = results[i].cumulativeGEX;
            if ((prevCum < 0 && currCum >= 0) || (prevCum >= 0 && currCum < 0)) {
                inflection = results[i].strike;
                break;
            }
            prevCum = currCum;
        }

        if (!inflection) {
            // Find strike with cumulative closest to zero
            let minCum = Infinity;
            for (const item of results) {
                if (Math.abs(item.cumulativeGEX) < minCum) {
                    minCum = Math.abs(item.cumulativeGEX);
                    inflection = item.strike;
                }
            }
        }

        // Calculate Max Pain
        for (const item of results) {
            let pain = 0;
            for (const other of results) {
                if (other.callOI > 0 && other.strike > item.strike) {
                    pain += other.callOI * (other.strike - item.strike);
                }
                if (other.putOI > 0 && other.strike < item.strike) {
                    pain += other.putOI * (item.strike - other.strike);
                }
            }
            if (pain < minPain) {
                minPain = pain;
                maxPain = item.strike;
            }
        }

        // Net GEX at spot (cumulative up to spot)
        let netGEX = 0;
        for (const item of results) {
            if (item.strike >= spotPrice) {
                netGEX = item.cumulativeGEX;
                break;
            }
        }

        // Net DEX at spot
        let netDEX = 0;
        for (const item of results) {
            if (item.strike >= spotPrice) {
                netDEX = item.cumulativeDEX;
                break;
            }
        }

        // Total GEX
        const totalGEX = results.reduce((sum, item) => sum + item.totalGEX, 0);
        const totalDEX = results.reduce((sum, item) => sum + item.totalDEX, 0);
        const totalVanna = results.reduce((sum, item) => sum + item.totalVanna, 0);
        const totalCharm = results.reduce((sum, item) => sum + item.totalCharm, 0);

        // Determine regime
        const isPositiveGamma = spotPrice > inflection;

        // IV Skew: difference between ATM put IV and ATM call IV
        const atmItem = results.reduce((closest, item) => 
            Math.abs(item.strike - spotPrice) < Math.abs(closest.strike - spotPrice) ? item : closest
        , results[0]);
        const ivSkew = (atmItem.putIV - atmItem.callIV) * 100; // in percentage points

        return {
            callWall,
            putWall,
            inflection,
            zeroGamma,
            maxPain,
            netGEX,
            netDEX,
            totalGEX,
            totalDEX,
            totalVanna,
            totalCharm,
            isPositiveGamma,
            maxCallGEX,
            minPutGEX,
            ivSkew,
            atmItem
        };
    }

    // ===== FORMATTERS =====

    function formatNumber(num) {
        if (!num && num !== 0) return '--';
        const abs = Math.abs(num);
        if (abs >= 1000000000) return (num / 1000000000).toFixed(2) + 'B';
        if (abs >= 1000000) return (num / 1000000).toFixed(2) + 'M';
        if (abs >= 1000) return (num / 1000).toFixed(1) + 'K';
        return num.toFixed(0);
    }

    function formatPrice(price) {
        if (!price && price !== 0) return '--';
        return price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }

    function formatPercent(num) {
        if (!num && num !== 0) return '--';
        return (num >= 0 ? '+' : '') + num.toFixed(2) + '%';
    }

    // ===== PUBLIC API =====
    return {
        calculateAllGreeks,
        findKeyLevels,
        formatNumber,
        formatPrice,
        formatPercent,
        // Expose individual greeks for advanced use
        delta,
        gamma,
        vega,
        theta,
        vanna,
        charm
    };
})();
