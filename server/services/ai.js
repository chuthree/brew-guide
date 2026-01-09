/**
 * 🤖 AI 调用服务
 *
 * 封装与 AI API 的交互逻辑
 *
 * @module services/ai
 */

import { aiConfig, apiKeys, aiPrompts } from '../config.js';
import logger from '../utils/logger.js';
import { getAIAdapter } from './ai-providers/index.js';

/**
 * 获取 AI 配置
 * 优先使用 clientConfig，否则使用 aiConfig 中的默认配置
 */
function getProviderConfig(clientConfig, type = 'beanRecognition') {
  if (clientConfig && clientConfig.apiKey) {
    return {
      apiKey: clientConfig.apiKey,
      baseURL: clientConfig.apiHost,
      model: clientConfig.model,
      adapterType: clientConfig.type || 'openai',
      // User provided config usually doesn't have internal timeouts/limits defined, use defaults
      timeout: aiConfig[type]?.timeout || 60000,
      maxTokens: aiConfig[type]?.maxTokens || 2000,
      temperature: aiConfig[type]?.temperature || 0.7,
    };
  }

  // Fallback to server config
  const serverConfig = aiConfig[type];
  const apiKey = 
    type === 'beanRecognition' || type === 'methodRecognition' ? apiKeys.qiniu : 
    type === 'yearlyReport' || type === 'feedbackModeration' || type === 'dailyRecommendation' ? apiKeys.siliconflow : 
    '';

  return {
    apiKey,
    baseURL: serverConfig.baseURL,
    model: serverConfig.model,
    adapterType: 'openai', // Server defaults are OpenAI compatible
    timeout: serverConfig.timeout,
    maxTokens: serverConfig.maxTokens,
    temperature: serverConfig.temperature,
  };
}

/**
 * 调用 AI 识别咖啡豆（流式）
 *
 * @param {string} imageUrl - 图片 Base64 URL
 * @param {Object} [clientConfig] - 客户端提供的 AI 配置
 * @returns {Promise<Stream>} 流式响应
 */
export async function recognizeBeanStreaming(imageUrl, clientConfig) {
  const startTime = Date.now();
  const config = getProviderConfig(clientConfig, 'beanRecognition');
  
  logger.info(`🤖 Starting AI bean recognition (streaming) using ${config.adapterType}...`);

  const adapter = getAIAdapter(config.adapterType);
  
  try {
    const response = await adapter.visionCompletion({
      apiKey: config.apiKey,
      baseURL: config.baseURL,
      model: config.model,
      prompt: aiPrompts.beanRecognition,
      imageUrls: [imageUrl],
      temperature: config.temperature,
      maxTokens: config.maxTokens,
    });

    const duration = Date.now() - startTime;
    logger.logAI(config.model, duration);

    return response;
  } catch (error) {
    logger.error('Bean recognition streaming failed', error);
    throw error;
  }
}

/**
 * 调用 AI 识别咖啡豆（非流式）
 *
 * @param {string} imageUrl - 图片 Base64 URL
 * @param {Object} [clientConfig] - 客户端提供的 AI 配置
 * @returns {Promise<string>} AI 响应内容
 */
export async function recognizeBean(imageUrl, clientConfig) {
  const startTime = Date.now();
  const config = getProviderConfig(clientConfig, 'beanRecognition');

  logger.info(`🤖 Starting AI bean recognition using ${config.adapterType}...`);

  const adapter = getAIAdapter(config.adapterType);

  try {
    const response = await adapter.visionCompletion({
      apiKey: config.apiKey,
      baseURL: config.baseURL,
      model: config.model,
      prompt: aiPrompts.beanRecognition,
      imageUrls: [imageUrl],
      temperature: config.temperature,
      maxTokens: config.maxTokens,
    });

    const duration = Date.now() - startTime;
    logger.logAI(config.model, duration);

    // Adapter returns axios response, need to extract content based on provider
    const data = response.data;
    const content = data.choices?.[0]?.message?.content || 
                    data.candidates?.[0]?.content?.parts?.[0]?.text || // Gemini
                    data.content?.[0]?.text || // Anthropic
                    JSON.stringify(data);

    return content;
  } catch (error) {
    logger.error('Bean recognition failed', error);
    throw error;
  }
}

/**
 * 调用 AI 识别冲煮方案
 *
 * @param {string} imageUrl - 图片 Base64 URL
 * @param {Object} [clientConfig] - 客户端提供的 AI 配置
 * @returns {Promise<string>} AI 响应内容
 */
export async function recognizeMethod(imageUrl, clientConfig) {
  const startTime = Date.now();
  const config = getProviderConfig(clientConfig, 'methodRecognition');

  logger.info(`🤖 Starting AI method recognition using ${config.adapterType}...`);

  const adapter = getAIAdapter(config.adapterType);

  try {
    const response = await adapter.visionCompletion({
      apiKey: config.apiKey,
      baseURL: config.baseURL,
      model: config.model,
      prompt: aiPrompts.methodRecognition,
      imageUrls: [imageUrl],
      temperature: config.temperature,
      maxTokens: config.maxTokens,
    });

    const duration = Date.now() - startTime;
    logger.logAI(config.model, duration);

    // Adapter returns axios response, need to extract content based on provider
    const data = response.data;
    const content = data.choices?.[0]?.message?.content || 
                    data.candidates?.[0]?.content?.parts?.[0]?.text || // Gemini
                    data.content?.[0]?.text || // Anthropic
                    JSON.stringify(data);

    return content;
  } catch (error) {
    logger.error('Method recognition failed', error);
    throw error;
  }
}

/**
 * 智能推荐咖啡豆
 *
 * @param {Array} history - 历史记录
 * @param {Array} inventory - 库存列表
 * @param {Object} [clientConfig] - 客户端 AI 配置
 */
export async function recommendBean(history, inventory, clientConfig) {
  const startTime = Date.now();
  const config = getProviderConfig(clientConfig, 'dailyRecommendation');
  
  logger.info(`🤖 Starting bean recommendation using ${config.adapterType}...`);

  const adapter = getAIAdapter(config.adapterType);

  // Construct Prompt
  let prompt = '';
  const customPrompt = clientConfig?.prompt;

  if (customPrompt) {
    prompt = customPrompt
      .replace('{{history}}', history.map(h => `- ${h.beanName} (${h.method}): ${h.rating || '无评分'}`).join('\n'))
      .replace('{{inventory}}', inventory.map(b => `- ${b.name} (id: ${b.id}, ${b.roastLevel || '未知烘焙度'}, ${b.process || '未知处理法'}, ${b.flavors ? '风味:' + b.flavors.join(',') : ''}, 剩余:${b.remaining})`).join('\n'));
  } else {
    // 默认使用配置中的 Prompt
    prompt = aiPrompts.dailyRecommendation
      .replace('{{history}}', history.map(h => `- ${h.beanName} (${h.method}): ${h.rating || '无评分'}`).join('\n'))
      .replace('{{inventory}}', inventory.map(b => `- ${b.name} (id: ${b.id}, ${b.roastLevel || '未知烘焙度'}, ${b.process || '未知处理法'}, ${b.flavors ? '风味:' + b.flavors.join(',') : ''}, 剩余:${b.remaining})`).join('\n'));

    // 确保包含 JSON 格式要求 (因为 config 中的 prompt 已经包含了这些要求，这里不再重复添加，或者确保 config 中的 prompt 是完整的)
    /*
    prompt += `
    
    返回格式 JSON:
    {
      "beanId": "...",
      "reason": "...",
      "luckyMessage": "..."
    }
    `;
    */
  }

  try {
    const response = await adapter.chatCompletion({
      apiKey: config.apiKey,
      baseURL: config.baseURL,
      model: config.model,
      messages: [
        { role: 'user', content: prompt }
      ],
      temperature: config.temperature,
      maxTokens: config.maxTokens,
      response_format: { type: 'json_object' } // Force JSON if supported
    });

    const duration = Date.now() - startTime;
    logger.logAI(config.model, duration);

    const data = response.data;
    let content = data.choices?.[0]?.message?.content || 
                 data.candidates?.[0]?.content?.parts?.[0]?.text ||
                 data.content?.[0]?.text ||
                 JSON.stringify(data);

    // Clean and Parse JSON
    try {
      const jsonStr = content.replace(/```json\n?|\n?```/g, '').trim();
      return JSON.parse(jsonStr);
    } catch (e) {
      logger.error('Failed to parse AI response:', content);
      throw new Error('AI returned invalid format');
    }
  } catch (error) {
    logger.error('Recommendation failed', error);
    throw error;
  }
}

/**
 * 生成年度报告（流式）
 */
export async function generateYearlyReportStreaming(dataSummary, clientConfig) {
  const startTime = Date.now();
  const config = getProviderConfig(clientConfig, 'yearlyReport');

  logger.info(`🤖 Starting yearly report generation using ${config.adapterType}...`);

  const adapter = getAIAdapter(config.adapterType);

  try {
    const response = await adapter.chatCompletion({
      apiKey: config.apiKey,
      baseURL: config.baseURL,
      model: config.model,
      messages: [
        { role: 'system', content: aiPrompts.yearlyReport },
        { role: 'user', content: dataSummary }
      ],
      stream: true,
      temperature: config.temperature,
      maxTokens: config.maxTokens,
    });

    return response;
  } catch (error) {
    logger.error('Yearly report generation failed', error);
    throw error;
  }
}

/**
 * 内容审核（非流式）
 */
export async function moderateFeedback(content, clientConfig) {
  const config = getProviderConfig(clientConfig, 'feedbackModeration');
  const adapter = getAIAdapter(config.adapterType);

  try {
    // For moderation we ideally want JSON
    const response = await adapter.chatCompletion({
      apiKey: config.apiKey,
      baseURL: config.baseURL,
      model: config.model,
      messages: [
        { role: 'system', content: aiPrompts.feedbackModeration },
        { role: 'user', content: `请审核以下用户反馈内容：\n${content}` }
      ],
      temperature: 0.1,
      maxTokens: 100,
      // Only OpenAI supports response_format in this way, others might ignore or need different handling
      responseFormat: config.adapterType === 'openai' ? { type: 'json_object' } : undefined
    });

    const data = response.data;
    const resultText = data.choices?.[0]?.message?.content || 
                       data.candidates?.[0]?.content?.parts?.[0]?.text ||
                       data.content?.[0]?.text ||
                       JSON.stringify(data);
    
    // Attempt to parse JSON
    try {
      // Cleanup cleanup markdown
      const jsonStr = resultText.replace(/```json/g, '').replace(/```/g, '').trim();
      return JSON.parse(jsonStr);
    } catch (e) {
      logger.warn('Failed to parse moderation result JSON', resultText);
      // Fallback check
      const lower = resultText.toLowerCase();
      if (lower.includes('true') || lower.includes('safe')) return { safe: true };
      return { safe: false, reason: 'Parse error' };
    }
  } catch (error) {
    logger.error('Moderation failed', error);
    throw error;
  }
}


