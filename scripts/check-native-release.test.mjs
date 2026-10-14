import assert from 'node:assert/strict';
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';

for (const newline of ['\n', '\r\n']) {
  test(`native release checks accept ${JSON.stringify(newline)} and reject version drift`, () => {
    const root = mkdtempSync(join(tmpdir(), 'brew-guide-release-check-'));
    try {
      for (const path of [
        'scripts/check-native-release.mjs',
        'package.json',
        'pnpm-lock.yaml',
        'src-tauri/tauri.conf.json',
        'src-tauri/Cargo.toml',
        'src-tauri/Cargo.lock',
        'src-tauri/src/storage.rs',
      ]) {
        const target = join(root, path);
        mkdirSync(dirname(target), { recursive: true });
        writeFileSync(
          target,
          readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
            .replace(/\r\n/g, '\n')
            .replace(/\n/g, newline)
        );
      }
      const run = () =>
        spawnSync(
          process.execPath,
          [join(root, 'scripts/check-native-release.mjs')],
          {
            encoding: 'utf8',
          }
        );
      const valid = run();
      assert.equal(valid.status, 0, valid.stderr);

      const lockPath = join(root, 'src-tauri/Cargo.lock');
      writeFileSync(
        lockPath,
        readFileSync(lockPath, 'utf8').replace(
          /name = "tauri"\r?\nversion = "[^"]+"/,
          `name = "tauri"${newline}version = "0.0.0"`
        )
      );
      const invalid = run();
      assert.notEqual(invalid.status, 0);
      assert.match(invalid.stderr, /Cargo.lock must match the manifest/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
}
