/**
 * 🌿 咖啡豆识别路由
 *
 * @module routes/bean
 */

import express from 'express';
import { rateLimiter } from '../middlewares/rate-limit.js';
import { upload } from '../middlewares/upload.js';
import {
  acquireAISlot,
  releaseAISlot,
  getConcurrencyStatus,
} from '../services/concurrency.js';
import { recognizeBeanStreaming, recognizeBean } from '../services/ai.js';
import { validateMagicNumber, validateBeanData } from '../utils/validator.js';
import { formatBytes } from '../utils/helpers.js';
import logger from '../utils/logger.js';

const router = express.Router();

/**
 * POST /api/recognize-bean
 * 咖啡豆识别接口
 */
router.post(
  '/recognize-bean',
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
        `Received bean recognition request, size: ${formatBytes(req.file.size)}`
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

      // 检查是否支持流式
      const acceptHeader = req.headers.accept || '';
      const supportsStreaming = acceptHeader.includes('text/event-stream');

      if (supportsStreaming) {
        // 流式响应
        logger.info('📡 Using streaming mode');
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');

        let isClientDisconnected = false;
        req.on('close', () => {
          if (!res.writableEnded) {
            logger.warn('Client disconnected, stopping streaming');
            isClientDisconnected = true;
            releaseAISlot();
          }
        });

        const response = await recognizeBeanStreaming(imageUrl);
        let fullContent = '';

        for await (const chunk of response.data) {
          if (isClientDisconnected) {
            logger.warn('Client disconnected detected, stopping processing');
            response.data.destroy();
            return;
          }

          const lines = chunk
            .toString()
            .split('\n')
            .filter(line => line.trim() !== '');

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6);
              if (data === '[DONE]') continue;

              try {
                const parsed = JSON.parse(data);
                const content = parsed.choices[0]?.delta?.content || '';
                if (content) {
                  fullContent += content;
                  if (!isClientDisconnected && !res.writableEnded) {
                    res.write(
                      `data: ${JSON.stringify({ content: fullContent })}\n\n`
                    );
                  }
                }
              } catch (e) {
                // Ignore parse errors
              }
            }
          }
        }

        res.write('data: [DONE]\n\n');
        res.end();

        logger.info(`✅ Streaming completed in ${Date.now() - startTime}ms`);
        releaseAISlot();
        return;
      }

      // 非流式响应
      logger.info('📦 Using standard mode');
      const aiResponse = await recognizeBean(imageUrl);

      logger.info('AI raw response:', aiResponse.substring(0, 200) + '...');

      // 解析 JSON
      let beanData;
      try {
        let jsonStr = aiResponse.trim();
        if (jsonStr.startsWith('```json')) {
          jsonStr = jsonStr.replace(/^```json\s*/, '').replace(/\s*```$/, '');
        } else if (jsonStr.startsWith('```')) {
          jsonStr = jsonStr.replace(/^```\s*/, '').replace(/\s*```$/, '');
        }

        beanData = JSON.parse(jsonStr);

        // 处理可能的嵌套结构
        if (
          beanData &&
          typeof beanData === 'object' &&
          !Array.isArray(beanData)
        ) {
          const possibleKeys = ['单豆', '多豆', '咖啡豆', 'beans', 'data'];
          for (const key of possibleKeys) {
            if (beanData[key]) {
              beanData = beanData[key];
              logger.warn(
                `Detected nested structure, extracted "${key}" field`
              );
              break;
            }
          }
        }

        // 验证数据
        const dataArray = Array.isArray(beanData) ? beanData : [beanData];
        dataArray.forEach(validateBeanData);

        logger.info('✅ JSON parsed and validated successfully');
      } catch (parseError) {
        logger.error('JSON parse failed:', parseError.message);
        releaseAISlot();
        return res.status(500).json({
          error: '无法识别图片中的咖啡豆信息',
          details: aiResponse,
          parseError: parseError.message,
        });
      }

      res.json({
        success: true,
        data: beanData,
        timestamp: new Date().toISOString(),
      });

      logger.info(`✅ Response sent in ${Date.now() - startTime}ms`);
      releaseAISlot();
    } catch (error) {
      releaseAISlot();
      logger.error('Bean recognition failed:', error);

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
