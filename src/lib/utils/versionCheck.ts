/**
 * 版本检测工具
 * 用于检测应用是否有新版本可用
 */

import { APP_VERSION } from '@/lib/core/config';

// 远程版本信息接口
interface RemoteVersionInfo {
  version: string;
  downloadUrl: string;
  releaseNotes?: string;
}

// 版本检测结果
export interface VersionCheckResult {
  hasUpdate: boolean;
  currentVersion: string;
  latestVersion?: string;
  downloadUrl?: string;
  releaseNotes?: string;
}

/**
 * 比较版本号
 * 支持格式：1.5.0, 1.5.0, 1.6.0-rc.2 等
 * @param v1 版本号1 (例如: "1.5.0" 或 "1.5.0")
 * @param v2 版本号2 (例如: "1.6.0" 或 "1.6.0-rc.2")
 * @returns 1: v1 > v2, 0: v1 = v2, -1: v1 < v2
 */
function compareVersions(v1: string, v2: string): number {
  // 解析版本号，分离主版本号和预发布标识
  const parseVersion = (version: string) => {
    const [mainVersion, preRelease] = version.split('-');
    const numbers = mainVersion.split('.').map(Number);
    return { numbers, preRelease };
  };

  const parsed1 = parseVersion(v1);
  const parsed2 = parseVersion(v2);

  // 先比较主版本号
  const maxLength = Math.max(parsed1.numbers.length, parsed2.numbers.length);
  for (let i = 0; i < maxLength; i++) {
    const num1 = parsed1.numbers[i] || 0;
    const num2 = parsed2.numbers[i] || 0;

    if (num1 > num2) return 1;
    if (num1 < num2) return -1;
  }

  // 主版本号相同，比较预发布标识
  // 有预发布标识的版本 < 无预发布标识的版本
  // 例如: 1.5.0 > 1.5.0-beta.1
  if (!parsed1.preRelease && parsed2.preRelease) return 1;
  if (parsed1.preRelease && !parsed2.preRelease) return -1;
  if (!parsed1.preRelease && !parsed2.preRelease) return 0;

  // 都有预发布标识，字符串比较
  // beta.1 < beta.2 < rc.1 < rc.2
  if (parsed1.preRelease! > parsed2.preRelease!) return 1;
  if (parsed1.preRelease! < parsed2.preRelease!) return -1;

  return 0;
}

/**
 * 检测版本更新
 * 从远程 JSON 文件获取最新版本信息
 */
export async function checkForUpdates(): Promise<VersionCheckResult> {
  try {
    // 从远程获取版本信息，使用代理避免跨域问题
    const baseUrl = 'https://coffee.chu3.top/version.json';
    const proxyUrl = `https://cors.chu3.top/raw?url=${encodeURIComponent(`${baseUrl}?t=${Date.now()}`)}`;

    const response = await fetch(proxyUrl, {
      headers: {
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch version info: ${response.status}`);
    }

    const versionInfo: RemoteVersionInfo = await response.json();

    // 比较版本号
    const hasUpdate = compareVersions(versionInfo.version, APP_VERSION) > 0;

    return {
      hasUpdate,
      currentVersion: APP_VERSION,
      latestVersion: versionInfo.version,
      downloadUrl: versionInfo.downloadUrl,
      releaseNotes: versionInfo.releaseNotes,
    };
  } catch (error) {
    // 网络错误时返回错误信息，而不是静默失败
    throw error;
  }
}

/**
 * 保存检测时间
 */
export async function saveCheckTime(): Promise<void> {
  try {
    const { Storage } = await import('@/lib/core/storage');
    await Storage.set('lastVersionCheck', Date.now().toString());
  } catch {
    // 静默失败
  }
}
