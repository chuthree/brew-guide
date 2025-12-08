/**
 * 🔒 认证中间件
 *
 * 管理员权限验证
 *
 * @module middlewares/auth
 */

import { apiKeys } from '../config.js';
import { secureCompare } from '../utils/crypto.js';
import { getClientIP } from '../utils/helpers.js';
import logger from '../utils/logger.js';

/**
 * 管理员验证中间件
 */
export function adminAuth(req, res, next) {
  const adminKey = req.headers['x-admin-key'];
  const clientIP = getClientIP(req);

  if (!secureCompare(adminKey, apiKeys.admin)) {
    logger.logSecurity('Admin auth failed', {
      ip: clientIP.substring(0, 15) + '...',
      path: req.path,
    });
    return res.status(403).json({ error: '无权限操作' });
  }

  // 记录管理员操作
  logger.info(
    `🔐 Admin auth success - IP: ${clientIP.substring(0, 15)}..., Path: ${req.path}`
  );
  next();
}

export default adminAuth;
