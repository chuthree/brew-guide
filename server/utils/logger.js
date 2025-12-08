/**
 * 📝 专业日志系统
 *
 * 使用 Winston 提供结构化日志，支持：
 * - 多级别日志（error, warn, info, debug）
 * - 文件持久化（error.log, combined.log）
 * - 开发环境控制台输出
 * - 生产环境 JSON 格式
 *
 * @module utils/logger
 */

import winston from 'winston';
import { serverConfig } from '../config.js';

const { combine, timestamp, printf, colorize, json, errors } = winston.format;

/**
 * 开发环境日志格式（彩色、易读）
 */
const devFormat = combine(
  colorize(),
  timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  errors({ stack: true }),
  printf(({ timestamp, level, message, stack }) => {
    const base = `${timestamp} [${level}]: ${message}`;
    return stack ? `${base}\n${stack}` : base;
  })
);

/**
 * 生产环境日志格式（JSON、结构化）
 */
const prodFormat = combine(timestamp(), errors({ stack: true }), json());

/**
 * 创建日志传输器
 */
const transports = [
  // 错误日志单独存储
  new winston.transports.File({
    filename: 'error.log',
    level: 'error',
    maxsize: 5242880, // 5MB
    maxFiles: 5,
  }),
  // 所有日志合并存储
  new winston.transports.File({
    filename: 'combined.log',
    maxsize: 5242880, // 5MB
    maxFiles: 5,
  }),
];

// 开发环境添加控制台输出
if (serverConfig.env !== 'production') {
  transports.push(
    new winston.transports.Console({
      format: devFormat,
    })
  );
}

/**
 * Logger 实例
 */
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: serverConfig.env === 'production' ? prodFormat : devFormat,
  transports,
  // 处理未捕获的异常
  exceptionHandlers: [
    new winston.transports.File({ filename: 'exceptions.log' }),
  ],
  // 处理未处理的 Promise 拒绝
  rejectionHandlers: [
    new winston.transports.File({ filename: 'rejections.log' }),
  ],
});

/**
 * 便捷方法：记录 HTTP 请求
 */
logger.logRequest = (req, statusCode, duration) => {
  const { method, path, ip } = req;
  logger.info(`${method} ${path} ${statusCode} - ${duration}ms - ${ip}`);
};

/**
 * 便捷方法：记录 AI 调用
 */
logger.logAI = (model, duration, success = true) => {
  const emoji = success ? '✅' : '❌';
  logger.info(`${emoji} AI [${model}] - ${duration}ms`);
};

/**
 * 便捷方法：记录安全事件
 */
logger.logSecurity = (event, details = {}) => {
  logger.warn(`🔒 Security: ${event}`, details);
};

export default logger;
