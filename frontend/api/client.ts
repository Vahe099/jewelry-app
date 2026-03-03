/**
 * api/client.ts
 *
 * Probes LAN and ZeroTier backend URLs on startup, picks the first reachable
 * one, caches the winner in localStorage, and exposes apiFetch() + getBaseUrl().
 *
 * Strategy:
 *   - If a cached URL exists → use it immediately (fast startup).
 *     Revalidate in background; update cache if a better URL is found.
 *   - If no cache → probe synchronously before allowing any request.
 */

const LAN_URL = (import.meta.env.VITE_API_LAN_URL as string | undefined) || 'http://127.0.0.1:8000';
const ZT_URL  = (import.meta.env.VITE_API_ZT_URL  as string | undefined) || '';

const CACHE_KEY    = 'api_base_url';
const PROBE_PATH   = '/api/lookups';   // lightweight GET, no auth, always available
const PROBE_TIMEOUT = 2000;            // ms per attempt

// ── Probe a single URL ────────────────────────────────────────────────────────
async function probe(base: string): Promise<boolean> {
  if (!base) return false;
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), PROBE_TIMEOUT);
  try {
    const res = await fetch(`${base}${PROBE_PATH}`, { signal: ctrl.signal });
    return res.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(id);
  }
}

// ── Try LAN first, then ZT, throw if both fail ────────────────────────────────
async function detectBestUrl(): Promise<string> {
  if (await probe(LAN_URL)) {
    console.log('[API] ✓ LAN reachable →', LAN_URL);
    return LAN_URL;
  }
  if (ZT_URL && await probe(ZT_URL)) {
    console.log('[API] ✓ ZeroTier reachable →', ZT_URL);
    return ZT_URL;
  }
  throw new Error(
    `Backend unavailable: neither LAN (${LAN_URL}) nor ZeroTier (${ZT_URL}) responded.`
  );
}

// ── Singleton promise resolved as fast as possible ────────────────────────────
let _baseUrlPromise: Promise<string>;

const _cached = localStorage.getItem(CACHE_KEY);
if (_cached) {
  // Fast path: trust cache, resolve immediately, revalidate in background.
  _baseUrlPromise = Promise.resolve(_cached);
  console.log('[API] Using cached URL:', _cached, '(revalidating…)');
  detectBestUrl()
    .then(url => {
      if (url !== _cached) {
        console.log('[API] Switched to:', url, '(will use on next request)');
        localStorage.setItem(CACHE_KEY, url);
        // Update the promise so future calls (after this tick) use the new URL.
        _baseUrlPromise = Promise.resolve(url);
      }
    })
    .catch(() => {
      console.warn('[API] Background revalidation failed; keeping cached URL:', _cached);
    });
} else {
  // Slow path: must probe before any request can go out.
  _baseUrlPromise = detectBestUrl().then(url => {
    localStorage.setItem(CACHE_KEY, url);
    return url;
  });
}

/** Returns the selected base URL (waits for probe on first load without cache). */
export function getBaseUrl(): Promise<string> {
  return _baseUrlPromise;
}

/**
 * Drop-in replacement for fetch() that automatically prepends the selected base URL.
 * Usage: apiFetch('/api/lookups') or apiFetch('/create-ring', { method: 'POST', … })
 */
export async function apiFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const base = await _baseUrlPromise;
  return fetch(`${base}${path}`, options);
}
