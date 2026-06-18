const GH_PROXY_PREFIX = 'https://gh-proxy.org/';
const GITHUB_RELEASES_BASE =
  'https://github.com/chuthree/brew-guide/releases/download';

const normalizeVersion = (version: string) => version.replace(/^v/i, '');

const buildGithubReleaseUrl = (tag: string, assetName: string) =>
  `${GH_PROXY_PREFIX}${GITHUB_RELEASES_BASE}/${tag}/${assetName}`;

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
