/**
 * 🌐 CORS 中间件
 *
 * 跨域资源共享配置
 *
 * @module middlewares/cors
 */

import cors from 'cors';
import { corsConfig } from '../config.js';
import logger from '../utils/logger.js';

/**
 * CORS 中间件
 */
export const corsMiddleware = cors({
  origin: function (origin, callback) {
    // 允许没有 origin 的请求（如 curl、Postman）
    if (!origin) return callback(null, true);

    if (corsConfig.allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      logger.logSecurity('CORS rejected', { origin });
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: corsConfig.methods,
  credentials: corsConfig.credentials,
  allowedHeaders: corsConfig.allowedHeaders,
});

export default corsMiddleware;
