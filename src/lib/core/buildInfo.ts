import { APP_VERSION } from '@/lib/core/config';

const APP_GIT_SHA = process.env.NEXT_PUBLIC_APP_GIT_SHA || 'unknown';
const APP_BUILD_TIME = process.env.NEXT_PUBLIC_APP_BUILD_TIME || 'unknown';

function formatBuildTime(rawTime: string): string {
  const time = new Date(rawTime);
  if (Number.isNaN(time.getTime())) {
    return '未知时间';
  }

  const year = time.getFullYear();
  const month = `${time.getMonth() + 1}`.padStart(2, '0');
  const day = `${time.getDate()}`.padStart(2, '0');
  const hours = `${time.getHours()}`.padStart(2, '0');
  const minutes = `${time.getMinutes()}`.padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}`;
}

export const BUILD_INFO = {
  appVersion: APP_VERSION,
  gitSha: APP_GIT_SHA,
  gitShaShort: APP_GIT_SHA.slice(0, 8),
  buildTime: APP_BUILD_TIME,
  buildTimeLabel: formatBuildTime(APP_BUILD_TIME),
} as const;

export function getVersionLabel(isNativeApp: boolean): string {
  if (isNativeApp) {
    return `v${BUILD_INFO.appVersion}`;
  }

  const sha = BUILD_INFO.gitShaShort || 'unknown';
  return `Web 实时版(${sha})`;
}

export function getWebBuildDetail(): string {
  return `main@${BUILD_INFO.gitShaShort} · 构建于 ${BUILD_INFO.buildTimeLabel}`;
}
