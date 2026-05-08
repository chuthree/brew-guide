import assert from 'node:assert/strict';

import { normalizeRecognitionErrorMessage } from '../../node-functions/api/[[default]].js';

const upstreamInvalidUser =
  'denied for invalid user (request_id: chatcmpl-bf82e96a4314)';

assert.equal(
  normalizeRecognitionErrorMessage(upstreamInvalidUser),
  '识别服务鉴权异常，请稍后重试或联系管理员检查服务配置'
);

assert.equal(
  normalizeRecognitionErrorMessage('请上传图片文件'),
  '请上传图片文件'
);

assert.equal(
  normalizeRecognitionErrorMessage('upstream error (request_id: abc123)'),
  'upstream error'
);
