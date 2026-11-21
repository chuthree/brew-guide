import { readStillImageFile } from '../../images/stillImageUpload.js';

export const MAX_RECOGNITION_SOURCE_BYTES = 10 * 1024 * 1024;

/** @param {File} file @param {number} [maxBytes] */
export function readRecognitionImageFile(file, maxBytes) {
  if (file.name.includes('..') || /[/\\]/.test(file.name)) {
    throw new Error('文件名包含非法字符');
  }
  return readStillImageFile(file, maxBytes);
}

/** @param {File} file */
export function readRecognitionSourceImage(file) {
  return readRecognitionImageFile(file, MAX_RECOGNITION_SOURCE_BYTES);
}
