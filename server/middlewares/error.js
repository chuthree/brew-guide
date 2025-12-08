/**
 * ⚠️ 错误处理中间件
 *
 * 统一错误处理与响应
 *
 * @module middlewares/error
 */

import multer from 'multer';
import { uploadConfig } from '../config.js';
import logger from '../utils/logger.js';

/**
 * 404 处理中间件
 */
export function notFoundHandler(req, res) {
  logger.warn(`404 Not Found: ${req.method} ${req.path}`);
  res.status(404).json({
    error: '接口不存在',
    path: req.path,
  });
}

/**
 * 全局错误处理中间件
 */
export function errorHandler(error, req, res, next) {
  logger.error('Server error:', {
    message: error.message,
    stack: error.stack,
    path: req.path,
  });

  // 处理 Multer 错误
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      const maxSizeMB = uploadConfig.maxFileSize / (1024 * 1024);
      return res.status(400).json({
        error: `文件过大，请上传不超过 ${maxSizeMB}MB 的图片`,
      });
    }
    return res.status(400).json({
      error: '文件上传错误',
      message: error.message,
    });
  }

  // 处理文件验证错误
  if (
    error.message &&
    (error.message.includes('不支持的文件类型') ||
      error.message.includes('文件名包含非法字符'))
  ) {
    return res.status(400).json({
      error: error.message,
    });
  }

  // 默认错误响应
  res.status(500).json({
    error: '服务器内部错误',
    message: error.message,
  });
}

export default {
  notFoundHandler,
  errorHandler,
};
