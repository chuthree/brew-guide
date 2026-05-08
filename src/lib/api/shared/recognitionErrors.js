export function normalizeRecognitionErrorMessage(message) {
  const fallback = '识别失败，请稍后重试';
  const text = String(message || '').trim();
  if (!text) return fallback;

  const sanitized = text
    .replace(/\s*\(?request[_ -]?id\s*:\s*[^)\s]+[)]?/gi, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (!sanitized) return fallback;

  if (
    /invalid\s+user|invalid\s+api\s*key|unauthori[sz]ed|authentication|forbidden|permission\s+denied|access\s+denied|denied\s+for/i.test(
      sanitized
    )
  ) {
    return '识别服务鉴权异常，请稍后重试或联系管理员检查服务配置';
  }

  return sanitized;
}
