import { readStillImageFile } from '../../images/stillImageUpload.js';

/** @param {File} file */
export function readRecognitionImageFile(file) {
  if (file.name.includes('..') || /[/\\]/.test(file.name)) {
    throw new Error('文件名包含非法字符');
  }
  return readStillImageFile(file);
}
