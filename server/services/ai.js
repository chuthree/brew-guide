/**
 * 🤖 AI 调用服务
 *
 * 封装与 AI API 的交互逻辑
 *
 * @module services/ai
 */

import axios from 'axios';
import { aiConfig, apiKeys, aiPrompts } from '../config.js';
import logger from '../utils/logger.js';
import { delay } from '../utils/helpers.js';

/**
 * 带重试的 axios 请求
 *
 * @param {Object} config - Axios 配置
 * @param {number} retries - 重试次数
 * @returns {Promise<Object>} 响应
 */
async function axiosWithRetry(
  config,
  retries = aiConfig.beanRecognition.maxRetries
) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await axios(config);
    } catch (error) {
      const isLastAttempt = attempt === retries;
      const isRetryable =
        error.code === 'ECONNRESET' ||
        error.code === 'ETIMEDOUT' ||
        error.code === 'ECONNABORTED' ||
        (error.response && error.response.status >= 500);

      if (isLastAttempt || !isRetryable) {
        throw error;
      }

      const delayMs = aiConfig.beanRecognition.retryDelay * (attempt + 1);
      logger.warn(
        `请求失败，${delayMs}ms 后重试 (${attempt + 1}/${retries})...`
      );
      await delay(delayMs);
    }
  }
}

/**
 * 调用 AI 识别咖啡豆（流式）
 *
 * @param {string} imageUrl - 图片 Base64 URL
 * @returns {Promise<Stream>} 流式响应
 */
export async function recognizeBeanStreaming(imageUrl) {
  const startTime = Date.now();

  logger.info('🤖 Starting AI bean recognition (streaming)...');

  const response = await axios.post(
    aiConfig.beanRecognition.baseURL,
    {
      model: aiConfig.beanRecognition.model,
      messages: [
        { role: 'system', content: aiPrompts.beanRecognition },
        {
          role: 'user',
          content: [{ type: 'image_url', image_url: { url: imageUrl } }],
        },
      ],
      stream: true,
      temperature: aiConfig.beanRecognition.temperature,
      max_tokens: aiConfig.beanRecognition.maxTokens,
      response_format: { type: 'json_object' },
    },
    {
      headers: {
        Authorization: `Bearer ${apiKeys.qiniu}`,
        'Content-Type': 'application/json',
      },
      timeout: aiConfig.beanRecognition.timeout,
      maxContentLength: 50 * 1024 * 1024,
      maxBodyLength: 50 * 1024 * 1024,
      responseType: 'stream',
    }
  );

  const duration = Date.now() - startTime;
  logger.logAI(aiConfig.beanRecognition.model, duration);

  return response;
}

/**
 * 调用 AI 识别咖啡豆（非流式）
 *
 * @param {string} imageUrl - 图片 Base64 URL
 * @returns {Promise<string>} AI 响应内容
 */
export async function recognizeBean(imageUrl) {
  const startTime = Date.now();

  logger.info('🤖 Starting AI bean recognition...');

  const response = await axiosWithRetry({
    method: 'post',
    url: aiConfig.beanRecognition.baseURL,
    data: {
      model: aiConfig.beanRecognition.model,
      messages: [
        { role: 'system', content: aiPrompts.beanRecognition },
        {
          role: 'user',
          content: [{ type: 'image_url', image_url: { url: imageUrl } }],
        },
      ],
      temperature: aiConfig.beanRecognition.temperature,
      max_tokens: aiConfig.beanRecognition.maxTokens,
      response_format: { type: 'json_object' },
    },
    headers: {
      Authorization: `Bearer ${apiKeys.qiniu}`,
      'Content-Type': 'application/json',
    },
    timeout: aiConfig.beanRecognition.timeout,
    maxContentLength: 50 * 1024 * 1024,
    maxBodyLength: 50 * 1024 * 1024,
  });

  const duration = Date.now() - startTime;
  logger.logAI(aiConfig.beanRecognition.model, duration);

  return response.data.choices[0]?.message?.content || '';
}

/**
 * 调用 AI 识别冲煮方案（非流式）
 *
 * @param {string} imageUrl - 图片 Base64 URL
 * @returns {Promise<string>} AI 响应内容
 */
export async function recognizeMethod(imageUrl) {
  const startTime = Date.now();

  logger.info('🤖 Starting AI method recognition...');

  const response = await axiosWithRetry({
    method: 'post',
    url: aiConfig.methodRecognition.baseURL,
    data: {
      model: aiConfig.methodRecognition.model,
      messages: [
        { role: 'system', content: aiPrompts.methodRecognition },
        {
          role: 'user',
          content: [{ type: 'image_url', image_url: { url: imageUrl } }],
        },
      ],
      temperature: aiConfig.methodRecognition.temperature,
      max_tokens: aiConfig.methodRecognition.maxTokens,
      response_format: { type: 'json_object' },
    },
    headers: {
      Authorization: `Bearer ${apiKeys.qiniu}`,
      'Content-Type': 'application/json',
    },
    timeout: aiConfig.methodRecognition.timeout,
    maxContentLength: 50 * 1024 * 1024,
    maxBodyLength: 50 * 1024 * 1024,
  });

  const duration = Date.now() - startTime;
  logger.logAI(aiConfig.methodRecognition.model, duration);

  return response.data.choices[0]?.message?.content || '';
}

/**
 * 调用 AI 生成年度报告（流式）
 *
 * @param {string} dataSummary - 数据摘要
 * @returns {Promise<Stream>} 流式响应
 */
export async function generateYearlyReportStreaming(dataSummary) {
  const startTime = Date.now();

  logger.info('🤖 Starting yearly report generation (streaming)...');

  const response = await axios.post(
    aiConfig.yearlyReport.baseURL,
    {
      model: aiConfig.yearlyReport.model,
      messages: [
        { role: 'system', content: aiPrompts.yearlyReport },
        {
          role: 'user',
          content: `请根据以下数据生成年度咖啡报告：\n${dataSummary}`,
        },
      ],
      temperature: aiConfig.yearlyReport.temperature,
      max_tokens: aiConfig.yearlyReport.maxTokens,
      stream: true,
    },
    {
      headers: {
        Authorization: `Bearer ${apiKeys.siliconflow}`,
        'Content-Type': 'application/json',
      },
      timeout: aiConfig.yearlyReport.timeout,
      responseType: 'stream',
    }
  );

  const duration = Date.now() - startTime;
  logger.logAI(aiConfig.yearlyReport.model, duration);

  return response;
}

/**
 * 审核反馈内容
 *
 * @param {string} content - 反馈内容
 * @returns {Promise<{safe: boolean}>} 审核结果
 */
export async function moderateFeedback(content) {
  const startTime = Date.now();
  logger.info('🤖 Starting feedback moderation...');

  try {
    const response = await axiosWithRetry({
      method: 'post',
      url: aiConfig.feedbackModeration.baseURL,
      data: {
        model: aiConfig.feedbackModeration.model,
        messages: [
          { role: 'system', content: aiPrompts.feedbackModeration },
          { role: 'user', content: content },
        ],
        temperature: aiConfig.feedbackModeration.temperature,
        max_tokens: aiConfig.feedbackModeration.maxTokens,
        response_format: { type: 'json_object' },
      },
      headers: {
        Authorization: `Bearer ${apiKeys.siliconflow}`,
        'Content-Type': 'application/json',
      },
      timeout: aiConfig.feedbackModeration.timeout,
    });

    const duration = Date.now() - startTime;
    logger.logAI(aiConfig.feedbackModeration.model, duration);

    const contentStr = response.data.choices[0]?.message?.content;
    if (!contentStr) {
      throw new Error('Empty response from AI');
    }

    const result = JSON.parse(contentStr);
    return {
      safe: typeof result.safe === 'boolean' ? result.safe : false,
    };
  } catch (error) {
    logger.error('Feedback moderation failed:', error);
    // AI 服务故障时，默认为不安全（转人工）
    return { safe: false };
  }
}

export default {
  recognizeBeanStreaming,
  recognizeBean,
  recognizeMethod,
  generateYearlyReportStreaming,
  moderateFeedback,
};
