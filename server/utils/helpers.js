/**
 * 🛠️ 通用工具函数
 *
 * @module utils/helpers
 */

/**
 * 获取客户端真实 IP
 *
 * @param {Object} req - Express 请求对象
 * @returns {string} IP 地址
 */
export function getClientIP(req) {
  return (
    req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    req.headers['x-real-ip'] ||
    req.ip ||
    req.connection?.remoteAddress ||
    'unknown'
  );
}

/**
 * 格式化文件大小
 *
 * @param {number} bytes - 字节数
 * @returns {string} 格式化后的大小
 */
export function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * 延迟执行
 *
 * @param {number} ms - 延迟毫秒数
 * @returns {Promise<void>}
 */
export function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 安全的 JSON 解析
 *
 * @param {string} str - JSON 字符串
 * @param {*} defaultValue - 解析失败时的默认值
 * @returns {*} 解析结果或默认值
 */
export function safeJsonParse(str, defaultValue = null) {
  try {
    return JSON.parse(str);
  } catch {
    return defaultValue;
  }
}

export default {
  getClientIP,
  formatBytes,
  delay,
  safeJsonParse,
};
