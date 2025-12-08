/**
 * ✅ 数据验证工具
 *
 * 提供各类数据验证功能
 *
 * @module utils/validator
 */

import { uploadConfig, validationRules } from '../config.js';
import logger from './logger.js';

/**
 * 验证文件名安全性
 *
 * @param {string} filename - 文件名
 * @returns {boolean} 是否安全
 */
export function isFilenameSafe(filename) {
  // 检查路径遍历攻击
  if (
    filename.includes('..') ||
    filename.includes('/') ||
    filename.includes('\\')
  ) {
    return false;
  }

  // 检查空字节注入
  if (filename.includes('\0')) {
    return false;
  }

  // 文件名长度限制
  if (filename.length > validationRules.filenameMaxLength) {
    return false;
  }

  return true;
}

/**
 * 验证文件的魔数（Magic Number）
 *
 * @param {Buffer} buffer - 文件内容缓冲区
 * @param {string} mimeType - 声明的 MIME 类型
 * @returns {boolean} 是否通过验证
 */
export function validateMagicNumber(buffer, mimeType) {
  const signatures = uploadConfig.magicNumbers[mimeType];

  if (!signatures) {
    logger.warn(`未定义 ${mimeType} 的魔数验证，跳过魔数检查`);
    return true;
  }

  // HEIC/HEIF 特殊处理
  if (mimeType === 'image/heic' || mimeType === 'image/heif') {
    if (buffer.length >= 12) {
      const ftypMarker = buffer.toString('ascii', 4, 8);
      if (ftypMarker === 'ftyp') {
        const brand = buffer.toString('ascii', 8, 12);
        const validBrands = ['heic', 'heix', 'hevc', 'hevx', 'mif1', 'msf1'];
        return validBrands.some(b => brand.toLowerCase().includes(b));
      }
    }
    return false;
  }

  // WebP 特殊处理
  if (mimeType === 'image/webp') {
    if (buffer.length >= 12) {
      const riff = buffer.toString('ascii', 0, 4);
      const webp = buffer.toString('ascii', 8, 12);
      return riff === 'RIFF' && webp === 'WEBP';
    }
    return false;
  }

  // 标准魔数检查
  for (const signature of signatures) {
    if (buffer.length < signature.length) continue;

    let match = true;
    for (let i = 0; i < signature.length; i++) {
      if (buffer[i] !== signature[i]) {
        match = false;
        break;
      }
    }
    if (match) return true;
  }

  return false;
}

/**
 * 验证咖啡豆数据的烘焙度
 *
 * @param {Object} bean - 咖啡豆数据
 * @returns {Object} 验证后的咖啡豆数据
 */
export function validateBeanData(bean) {
  // 验证 name 字段
  if (!bean.name || typeof bean.name !== 'string' || bean.name.trim() === '') {
    throw new Error('识别结果缺少咖啡豆名称');
  }

  // 验证并修正 roastLevel 字段
  if (bean.roastLevel) {
    if (!validationRules.roastLevels.includes(bean.roastLevel)) {
      logger.warn(
        `咖啡豆 "${bean.name}" 烘焙度 "${bean.roastLevel}" 不在有效选项中，已删除该字段`
      );
      delete bean.roastLevel;
    }
  }

  // 验证并修正 beanType 字段
  if (bean.beanType) {
    if (!validationRules.beanTypes.includes(bean.beanType)) {
      logger.warn(
        `咖啡豆 "${bean.name}" 类型 "${bean.beanType}" 不在有效选项中，已删除该字段`
      );
      delete bean.beanType;
    }
  }

  return bean;
}

/**
 * 验证反馈内容
 *
 * @param {string} content - 反馈内容
 * @returns {{valid: boolean, error?: string}} 验证结果
 */
export function validateFeedbackContent(content) {
  if (!content || typeof content !== 'string') {
    return { valid: false, error: '请输入反馈内容' };
  }

  const trimmed = content.trim();

  if (trimmed.length < validationRules.feedbackMinLength) {
    return {
      valid: false,
      error: `反馈内容至少需要 ${validationRules.feedbackMinLength} 个字符`,
    };
  }

  if (trimmed.length > validationRules.feedbackMaxLength) {
    return {
      valid: false,
      error: `反馈内容不能超过 ${validationRules.feedbackMaxLength} 个字符`,
    };
  }

  return { valid: true };
}

/**
 * 验证反馈状态
 *
 * @param {string} status - 状态值
 * @returns {boolean} 是否有效
 */
export function isValidFeedbackStatus(status) {
  return validationRules.feedbackStatuses.includes(status);
}

export default {
  isFilenameSafe,
  validateMagicNumber,
  validateBeanData,
  validateFeedbackContent,
  isValidFeedbackStatus,
};
