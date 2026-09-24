const DEFAULT_API_BASE_URL = 'https://coffee.chu3.top';
const BUNDLED_APP_HOSTNAMES = new Set(['app', 'tauri.localhost']);

function getDefaultApiBaseUrl() {
  if (typeof window !== 'undefined') {
    const { hostname, origin, protocol } = window.location;
    const isWebOrigin = protocol === 'http:' || protocol === 'https:';

    if (isWebOrigin && !BUNDLED_APP_HOSTNAMES.has(hostname)) {
      return origin;
    }
  }
  return DEFAULT_API_BASE_URL;
}

export const API_CONFIG = {
  // 部署网页走同域 Functions；打包应用没有本地 Functions，统一回退线上服务。
  baseURL: (process.env.NEXT_PUBLIC_API_URL || getDefaultApiBaseUrl()).replace(
    /\/+$/,
    ''
  ),
  timeoutMs: 125000,
} as const;
