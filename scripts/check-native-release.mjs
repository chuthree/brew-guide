import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path =>
  readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const config = JSON.parse(read('src-tauri/tauri.conf.json'));
const pkg = JSON.parse(read('package.json'));
const cargo = read('src-tauri/Cargo.toml');
const lock = read('src-tauri/Cargo.lock');
const jsApiVersions = new Set(
  Array.from(
    read('pnpm-lock.yaml').matchAll(/^  '@tauri-apps\/api@([^']+)':/gm),
    match => match[1]
  )
);
assert.deepEqual(
  [...jsApiVersions],
  [pkg.devDependencies['@tauri-apps/api']],
  'Use one locked Tauri JS API version, including plugins'
);
assert.equal(
  pkg.pnpm?.overrides?.['@tauri-apps/api'],
  pkg.devDependencies['@tauri-apps/api'],
  'Keep plugin API resolution aligned with the native runtime'
);
assert.equal(
  config.build.frontendDist,
  '../out',
  'Desktop must bundle the local frontend'
);
assert.equal(
  config.identifier,
  'com.brewguide.desktop',
  'Desktop data identity must remain stable'
);
assert.ok(
  (config.app.windows ?? []).every(
    window => !window.url || !/^https?:/.test(window.url)
  ),
  'Desktop windows must not load a remote app'
);
assert.ok(
  config.version === pkg.version ||
    (process.platform === 'win32' &&
      config.version === pkg.version.split('-')[0]),
  'Native and frontend release versions must match'
);
assert.equal(
  cargo.match(/^version = "([^"]+)"/m)?.[1],
  pkg.version,
  'Rust app version must match'
);
const rustVersion = cargo.match(/^tauri = \{ version = "=([^"]+)"/m)?.[1];
assert.ok(rustVersion, 'Pin the Rust Tauri version');
assert.equal(
  lock.match(/name = "tauri"\nversion = "([^"]+)"/)?.[1],
  rustVersion,
  'Cargo.lock must match the manifest'
);
assert.equal(
  pkg.devDependencies['@tauri-apps/api'].split('.').slice(0, 2).join('.'),
  rustVersion.split('.').slice(0, 2).join('.'),
  'JS/Rust Tauri major and minor must match'
);
assert.ok(
  read('src-tauri/src/storage.rs').includes('root.join("brew-guide.sqlite3")'),
  'Keep the established SQLite filename'
);
console.log('Native release configuration and locked Tauri versions verified.');
