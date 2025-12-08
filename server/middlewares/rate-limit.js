/**
 * 🚦 限流中间件
 *
 * 防止恶意请求和滥用
 *
 * @module middlewares/rate-limit
 */

import { rateLimitConfig } from '../config.js';
import { hashIP } from '../utils/crypto.js';
import { getClientIP } from '../utils/helpers.js';
import logger from '../utils/logger.js';

// 存储请求计数
const requestCounts = new Map();
const yearlyReportCounts = new Map();
const feedbackSubmitCounts = new Map();
const voteRateCounts = new Map();

/**
 * 通用限流逻辑
 *
 * @param {Map} store - 存储计数的 Map
 * @param {Object} config - 限流配置
 * @param {string} errorMessage - 错误消息
 * @returns {Function} Express 中间件
 */
function createRateLimiter(store, config, errorMessage) {
  return (req, res, next) => {
    const ip = getClientIP(req);
    const ipHash = hashIP(ip);
    const now = Date.now();

    if (!store.has(ipHash)) {
      store.set(ipHash, { count: 1, startTime: now });
      return next();
    }

    const data = store.get(ipHash);

    // 如果超过时间窗口，重置计数
    if (now - data.startTime > config.windowMs) {
      store.set(ipHash, { count: 1, startTime: now });
      return next();
    }

    // 检查是否超过限制
    if (
      data.count >= config.maxRequests ||
      data.count >= config.maxSubmissions ||
      data.count >= config.maxVotes
    ) {
      const timeLeftMs = config.windowMs - (now - data.startTime);
      const timeLeftMinutes = Math.ceil(timeLeftMs / 60000);
      const timeLeftHours = Math.ceil(timeLeftMs / (60 * 60 * 1000));

      logger.logSecurity('Rate limit exceeded', { ip: ipHash, path: req.path });

      const retryAfter =
        config.windowMs > 60 * 60 * 1000
          ? `${timeLeftHours} 小时`
          : `${timeLeftMinutes} 分钟`;

      return res.status(429).json({
        error: `${errorMessage}，请 ${retryAfter} 后再试`,
        retryAfter: Math.ceil(timeLeftMs / 1000),
      });
    }

    data.count++;
    next();
  };
}

/**
 * 通用速率限制中间件
 */
export const rateLimiter = createRateLimiter(
  requestCounts,
  rateLimitConfig.general,
  '请求过于频繁'
);

/**
 * 年度报告限流中间件
 */
export const yearlyReportRateLimiter = createRateLimiter(
  yearlyReportCounts,
  rateLimitConfig.yearlyReport,
  `年度报告生成次数已达上限（每天 ${rateLimitConfig.yearlyReport.maxRequests} 次）`
);

/**
 * 反馈提交限流中间件
 */
export const feedbackRateLimiter = createRateLimiter(
  feedbackSubmitCounts,
  rateLimitConfig.feedbackSubmit,
  '提交过于频繁'
);

/**
 * 投票限流中间件
 */
export const voteRateLimiter = createRateLimiter(
  voteRateCounts,
  rateLimitConfig.vote,
  '操作过于频繁'
);

/**
 * 清理过期记录（定期执行）
 */
function cleanupExpiredRecords(store, windowMs, intervalMs) {
  setInterval(() => {
    const now = Date.now();
    for (const [key, data] of store.entries()) {
      if (now - data.startTime > windowMs) {
        store.delete(key);
      }
    }
  }, intervalMs);
}

// 启动清理任务
cleanupExpiredRecords(
  requestCounts,
  rateLimitConfig.general.windowMs,
  5 * 60 * 1000
);
cleanupExpiredRecords(
  yearlyReportCounts,
  rateLimitConfig.yearlyReport.windowMs,
  60 * 60 * 1000
);
cleanupExpiredRecords(
  feedbackSubmitCounts,
  rateLimitConfig.feedbackSubmit.windowMs,
  10 * 60 * 1000
);
cleanupExpiredRecords(
  voteRateCounts,
  rateLimitConfig.vote.windowMs,
  5 * 60 * 1000
);

export default {
  rateLimiter,
  yearlyReportRateLimiter,
  feedbackRateLimiter,
  voteRateLimiter,
};
