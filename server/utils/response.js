/**
 * 统一响应处理工具
 * @module utils/response
 */

/**
 * 成功响应
 * @param {Response} res Express Response 对象
 * @param {any} data 返回数据
 * @param {string} message 消息提示
 * @param {number} status HTTP状态码，默认200
 */
export const success = (res, data = null, message = 'Success', status = 200) => {
  res.status(status).json({
    success: true,
    code: status,
    message,
    data,
  });
};

/**
 * 错误响应
 * @param {Response} res Express Response 对象
 * @param {string} message 错误消息
 * @param {number} status HTTP状态码，默认500
 * @param {string} code 错误代码
 */
export const error = (res, message = 'Internal Server Error', status = 500, code = 'INTERNAL_ERROR') => {
  res.status(status).json({
    success: false,
    code: status,
    errorCode: code,
    message,
  });
};

export const successResponse = success;
export const errorResponse = error;

export default {
    success,
    error,
    successResponse,
    errorResponse
};
