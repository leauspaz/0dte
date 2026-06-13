/* ===== API CLIENT =====
 * Fetches data from the local Python Flask backend
 * No CORS issues, no proxies, no rate limits
 */

const APIClient = (function() {
    'use strict';

    const BASE_URL = 'http://127.0.0.1:8080';

    async function fetchJSON(endpoint) {
        const response = await fetch(BASE_URL + endpoint);
        if (!response.ok) {
            const text = await response.text();
            throw new Error(`Server error ${response.status}: ${text.substring(0, 200)}`);
        }
        return response.json();
    }

    async function getQuote(ticker) {
        return fetchJSON(`/api/quote/${encodeURIComponent(ticker)}`);
    }

    async function getExpirations(ticker) {
        return fetchJSON(`/api/expirations/${encodeURIComponent(ticker)}`);
    }

    async function getGEX(ticker, expiration) {
        return fetchJSON(`/api/gex/${encodeURIComponent(ticker)}?expiration=${encodeURIComponent(expiration)}`);
    }

    return {
        getQuote,
        getExpirations,
        getGEX
    };
})();
