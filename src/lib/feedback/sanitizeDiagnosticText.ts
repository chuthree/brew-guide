/** Diagnostic text only; callers must exclude records, settings and request/response bodies. */
export function sanitizeDiagnosticText(text: string): string {
  return text
    .replace(
      /Failing row contains[^\r\n]*/gi,
      'Failing row contains [已隐藏记录内容]'
    )
    .replace(/(Key \([^)]+\)\s*=\s*)\([^\r\n]*\)/gi, '$1([已隐藏字段值])')
    .replace(
      /(invalid input syntax for [^\r\n:]+:\s*)[^\r\n]*/gi,
      '$1"[已隐藏字段值]"'
    )
    .replace(/(?:Bearer|Basic)\s+[^\s,;]+/gi, '[已隐藏认证信息]')
    .replace(
      /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g,
      '[已隐藏 JWT]'
    )
    .replace(/sb_(?:publishable|secret)_[A-Za-z0-9_-]+/g, '[已隐藏 Key]')
    .replace(
      /((?:password|passwd|secret(?:AccessKey)?|accessKeyId|anonKey|api[-_]?key|token|authorization|cookie)\s*["']?\s*[:=]\s*)[^\r\n]+/gi,
      '$1[已隐藏]'
    )
    .replace(/data:[^\s;,]+;base64,[a-z0-9+/=]+/gi, '[已隐藏文件内容]')
    .replace(/https?:\/\/[^\s<>"']+/gi, '[已隐藏 URL]');
}
