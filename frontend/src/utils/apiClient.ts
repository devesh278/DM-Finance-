/**
 * Unified API Client for D&M Finance Portfolio Optimizer
 * Automatically targets FastAPI on port 8000 when running under Vite dev (port 3000)
 * to bypass local node sandbox proxy EPERM issues, with seamless fallback.
 */

export const API_BASE =
  typeof window !== 'undefined' &&
  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ? 'http://localhost:8000'
    : '';

export function apiUrl(endpoint: string): string {
  if (endpoint.startsWith('http://') || endpoint.startsWith('https://')) {
    return endpoint;
  }
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  return `${API_BASE}${cleanEndpoint}`;
}

export async function apiFetch(endpoint: string, options: RequestInit = {}): Promise<Response> {
  const targetUrl = apiUrl(endpoint);
  
  // Always include credentials unless overridden
  const mergedOptions: RequestInit = {
    credentials: 'include',
    ...options,
  };

  try {
    const res = await fetch(targetUrl, mergedOptions);
    // If targeted fetch succeeded or returned standard API response (e.g. 401 unauth, 400 bad req)
    if (res.status < 500) {
      return res;
    }
    // If 500 or proxy failure and we tried localhost:8000, try relative as fallback
    if (API_BASE && !endpoint.startsWith('http')) {
      const fallbackRes = await fetch(endpoint, mergedOptions);
      return fallbackRes;
    }
    return res;
  } catch (err) {
    // If network error occurred on API_BASE, try relative endpoint fallback
    if (API_BASE && !endpoint.startsWith('http')) {
      try {
        const fallbackRes = await fetch(endpoint, mergedOptions);
        return fallbackRes;
      } catch {
        throw err;
      }
    }
    throw err;
  }
}
