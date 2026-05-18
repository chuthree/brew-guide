const GH_PROXY_PREFIX = 'https://gh-proxy.org/';
const GITHUB_RELEASES_BASE =
  'https://github.com/chuthree/brew-guide/releases/download';
const DESKTOP_DOWNLOAD_URL = 'https://chu3.top/brewguide';
const ONLINE_ANDROID_VERSION = '1.0.3';

const normalizeVersion = (version: string) => version.replace(/^v/i, '');

const buildGithubReleaseUrl = (tag: string, assetName: string) =>
  `${GH_PROXY_PREFIX}${GITHUB_RELEASES_BASE}/${tag}/${assetName}`;

export const getDesktopDownloadUrl = () => DESKTOP_DOWNLOAD_URL;

export const getOfflineIosDownloadUrl = (version: string) => {
  const normalizedVersion = normalizeVersion(version);
  return buildGithubReleaseUrl(
    `v${normalizedVersion}`,
    `BrewGuide_${normalizedVersion}_ios.ipa`
  );
};

export const getOfflineAndroidDownloadUrl = (version: string) => {
  const normalizedVersion = normalizeVersion(version);
  return buildGithubReleaseUrl(
    `v${normalizedVersion}`,
    `BrewGuide_${normalizedVersion}_android.apk`
  );
};

export const getOnlineAndroidDownloadUrl = (
  version = ONLINE_ANDROID_VERSION
) => {
  const normalizedVersion = normalizeVersion(version);
  return buildGithubReleaseUrl(
    `v${normalizedVersion}-online`,
    `BrewGuide-OL_${normalizedVersion}_android.apk`
  );
};
