/**
 * 🧹 内容安全过滤工具
 *
 * 防止 XSS 攻击、SQL 注入等安全问题
 *
 * @module utils/sanitize
 */

/**
 * 过滤危险字符（XSS 防护）
 *
 * @param {string} content - 用户输入的内容
 * @returns {string} 安全的内容
 */
export function sanitizeContent(content) {
  if (typeof content !== 'string') return '';

  return content
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

/**
 * 清理并限制文本长度
 *
 * @param {string} text - 文本内容
 * @param {number} maxLength - 最大长度
 * @returns {string} 清理后的文本
 */
export function sanitizeText(text, maxLength = 1000) {
  if (typeof text !== 'string') return '';

  return sanitizeContent(text.trim()).substring(0, maxLength);
}

export default {
  sanitizeContent,
  sanitizeText,
};
