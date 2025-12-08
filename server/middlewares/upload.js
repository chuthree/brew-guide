/**
 * 📤 文件上传中间件
 *
 * 使用 Multer 处理文件上传
 *
 * @module middlewares/upload
 */

import multer from 'multer';
import { uploadConfig } from '../config.js';
import { isFilenameSafe } from '../utils/validator.js';

/**
 * Multer 配置
 */
export const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: uploadConfig.maxFileSize,
  },
  fileFilter: (req, file, cb) => {
    // 验证文件名安全性
    if (!isFilenameSafe(file.originalname)) {
      return cb(new Error('文件名包含非法字符'));
    }

    // 验证 MIME 类型
    if (!uploadConfig.allowedMimeTypes.includes(file.mimetype)) {
      return cb(
        new Error(
          `不支持的文件类型: ${file.mimetype}，请上传 JPG、PNG、GIF 或 WebP 图片`
        )
      );
    }

    cb(null, true);
  },
});

export default upload;
