export const API_CONFIG = {
  // 默认走同域 EdgeOne Functions（可通过 NEXT_PUBLIC_API_URL 覆盖）
  baseURL: (process.env.NEXT_PUBLIC_API_URL || '').replace(/\/+$/, ''),
  timeoutMs: 120000,
} as const;
