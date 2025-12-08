/**
 * 🔐 加密与安全工具
 *
 * 提供加密、哈希、安全比较等功能
 *
 * @module utils/crypto
 */

import crypto from 'crypto';
import { securityConfig } from '../config.js';

/**
 * 将 IP 地址哈希化（保护隐私）
 *
 * @param {string} ip - IP 地址
 * @returns {string} 哈希后的 IP（16 位）
 */
export function hashIP(ip) {
  return crypto
    .createHash('sha256')
    .update(ip + securityConfig.ipHashSalt)
    .digest('hex')
    .substring(0, 16);
}

/**
 * 时间安全的字符串比较（防止时序攻击）
 *
 * 用于敏感信息比较（如密钥、令牌等）
 *
 * @param {string} a - 字符串 A
 * @param {string} b - 字符串 B
 * @returns {boolean} 是否相等
 */
export function secureCompare(a, b) {
  if (!a || !b) {
    return false;
  }

  if (a.length !== b.length) {
    return false;
  }

  try {
    return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
  } catch {
    return false;
  }
}

/**
 * 生成唯一 ID
 *
 * @returns {string} 时间戳 + 随机字符串
 */
export function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 9);
}

export default {
  hashIP,
  secureCompare,
  generateId,
};
