import assert from 'node:assert/strict';

import { normalizeRecognitionErrorMessage } from '../../src/lib/api/shared/recognition';

assert.equal(
  normalizeRecognitionErrorMessage(
    '实验性识别请求失败 (500): denied for invalid user (request_id: chatcmpl-bf82e96a4314)'
  ),
  '识别服务鉴权异常，请稍后重试或联系管理员检查服务配置'
);

assert.equal(
  normalizeRecognitionErrorMessage('请求失败，请检查网络连接或尝试更新应用'),
  '请求失败，请检查网络连接或尝试更新应用'
);
