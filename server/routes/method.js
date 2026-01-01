/**
 * 🧪 冲煮方案识别路由
 *
 * @module routes/method
 */

import express from 'express';
import { rateLimiter } from '../middlewares/rate-limit.js';
import { upload } from '../middlewares/upload.js';
import {
  acquireAISlot,
  releaseAISlot,
  getConcurrencyStatus,
} from '../services/concurrency.js';
import { recognizeMethod } from '../services/ai.js';
import { validateMagicNumber } from '../utils/validator.js';
import { formatBytes } from '../utils/helpers.js';
import logger from '../utils/logger.js';

const router = express.Router();

/**
 * 验证冲煮方案数据
 * @param {Object} method - 方案数据
 * @throws {Error} 验证失败时抛出错误
 */
function validateMethodData(method) {
  if (!method || typeof method !== 'object') {
    throw new Error('Invalid method data');
  }

  if (!method.name || typeof method.name !== 'string') {
    throw new Error('Method must have a name');
  }

  if (!method.params || typeof method.params !== 'object') {
    throw new Error('Method must have params');
  }

  if (!method.params.stages || !Array.isArray(method.params.stages)) {
    throw new Error('Method must have stages array');
  }

  if (method.params.stages.length === 0) {
    throw new Error('Method must have at least one stage');
  }
}

/**
 * POST /api/recognize-method
 * 冲煮方案识别接口
 */
router.post(
  '/recognize-method',
  rateLimiter,
  upload.single('image'),
  async (req, res) => {
    const startTime = Date.now();

    // 获取 AI 请求许可
    await acquireAISlot();
    const status = getConcurrencyStatus();
    logger.info(
      `📊 AI Concurrency: ${status.current}/${status.max}, Queue: ${status.queued}`
    );

    try {
      if (!req.file) {
        releaseAISlot();
        return res.status(400).json({ error: '请上传图片文件' });
      }

      logger.info(
        `Received method recognition request, size: ${formatBytes(req.file.size)}`
      );

      // 验证文件魔数
      if (!validateMagicNumber(req.file.buffer, req.file.mimetype)) {
        logger.error(
          `Magic number validation failed: ${req.file.originalname} (${req.file.mimetype})`
        );
        releaseAISlot();
        return res.status(400).json({
          error: '文件内容与声明的类型不匹配，请上传有效的图片文件',
        });
      }
      logger.info(`✅ Magic number validation passed: ${req.file.mimetype}`);

      // 转换为 Base64
      const base64StartTime = Date.now();
      const base64Image = req.file.buffer.toString('base64');
      const imageUrl = `data:${req.file.mimetype};base64,${base64Image}`;
      logger.debug(`Base64 encoding: ${Date.now() - base64StartTime}ms`);

      // 非流式响应
      logger.info('📦 Using standard mode for method recognition');
      const aiResponse = await recognizeMethod(imageUrl);

      logger.info(
        `AI raw response (${aiResponse.length} chars): ${aiResponse}`
      );

      // 解析 JSON
      let methodData;
      try {
        let jsonStr = aiResponse.trim();
        if (jsonStr.startsWith('```json')) {
          jsonStr = jsonStr.replace(/^```json\s*/, '').replace(/\s*```$/, '');
        } else if (jsonStr.startsWith('```')) {
          jsonStr = jsonStr.replace(/^```\s*/, '').replace(/\s*```$/, '');
        }

        methodData = JSON.parse(jsonStr);

        // 处理可能的嵌套结构
        if (
          methodData &&
          typeof methodData === 'object' &&
          !Array.isArray(methodData)
        ) {
          const possibleKeys = ['method', '方案', 'data'];
          for (const key of possibleKeys) {
            if (methodData[key] && typeof methodData[key] === 'object') {
              methodData = methodData[key];
              logger.warn(
                `Detected nested structure, extracted "${key}" field`
              );
              break;
            }
          }
        }

        // 修复数据格式
        const fixMethodData = method => {
          // 确保 stages 是数组
          if (method.params && method.params.stages) {
            if (!Array.isArray(method.params.stages)) {
              method.params.stages = [method.params.stages];
            }

            // 修复每个 stage
            method.params.stages = method.params.stages.map(stage => {
              // 确保 duration 是数字
              if (typeof stage.duration === 'string') {
                stage.duration = parseInt(stage.duration, 10) || 0;
              }
              // 确保 water 是字符串（如果存在）
              if (stage.water !== undefined && typeof stage.water === 'number') {
                stage.water = String(stage.water);
              }
              return stage;
            });
          }
          return method;
        };

        methodData = fixMethodData(methodData);

        // 验证数据
        validateMethodData(methodData);

        logger.info('✅ JSON parsed and validated successfully');
      } catch (parseError) {
        logger.error('JSON parse failed:', parseError.message);
        releaseAISlot();
        return res.status(500).json({
          error: '无法识别图片中的冲煮方案信息',
          details: aiResponse,
          parseError: parseError.message,
        });
      }

      res.json({
        success: true,
        data: methodData,
        timestamp: new Date().toISOString(),
      });

      logger.info(`✅ Response sent in ${Date.now() - startTime}ms`);
      releaseAISlot();
    } catch (error) {
      releaseAISlot();
      logger.error('Method recognition failed:', error);

      if (error.response) {
        return res.status(error.response.status).json({
          error: '图片识别失败',
          details: error.response.data,
        });
      }

      res.status(500).json({
        error: '服务器内部错误',
        message: error.message,
      });
    }
  }
);

export default router;
