/**
 * 🚀 Brew Guide API Server
 *
 * 模块化、高性能、安全的 Express 服务器
 *
 * @author Brew Guide Team
 * @version 2.0.0
 */

import express from 'express';
import { serverConfig } from './config.js';
import logger from './utils/logger.js';

// 中间件
import { corsMiddleware } from './middlewares/cors.js';
import { notFoundHandler, errorHandler } from './middlewares/error.js';

// 路由
import healthRouter from './routes/health.js';
import beanRouter from './routes/bean.js';
import methodRouter from './routes/method.js';
import reportRouter from './routes/report.js';
import feedbackRouter from './routes/feedback.js';

// 创建 Express 应用
const app = express();

// ==================== 基础中间件 ====================
app.use(corsMiddleware);
app.use(express.json({ limit: '10mb' }));

// ==================== 路由注册 ====================
app.use('/', healthRouter);
app.use('/api', beanRouter);
app.use('/api', methodRouter);
app.use('/api', reportRouter);
app.use('/api', feedbackRouter);

// ==================== 错误处理 ====================
app.use(notFoundHandler);
app.use(errorHandler);

// ==================== 启动服务器 ====================
const server = app.listen(serverConfig.port, serverConfig.host, () => {
  logger.info(`
╔═══════════════════════════════════════════════════╗
║   🚀 Brew Guide API Server v2.0.0                 ║
║                                                   ║
║   📡 Address: http://${serverConfig.host}:${serverConfig.port.toString().padEnd(4)} ║
║   🏥 Health:  http://${serverConfig.host}:${serverConfig.port}/health       ║
║   🌿 Bean:    POST /api/recognize-bean            ║
║   🧪 Method:  POST /api/recognize-method          ║
║   📊 Report:  POST /api/yearly-report             ║
║   💬 Feedback: GET/POST /api/feedbacks            ║
║                                                   ║
║   🌍 Environment: ${serverConfig.env.padEnd(11)}                    ║
║   ⏰ Started: ${new Date().toLocaleString('zh-CN').padEnd(19)}      ║
╚═══════════════════════════════════════════════════╝
  `);
});

// ==================== 优雅关闭 ====================
async function gracefulShutdown(signal) {
  logger.info(`Received ${signal}, shutting down gracefully...`);

  server.close(() => {
    logger.info('HTTP server closed');
    process.exit(0);
  });

  // 30秒后强制退出
  setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 30000);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// ==================== 未捕获异常处理 ====================
process.on('uncaughtException', error => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

export default app;
