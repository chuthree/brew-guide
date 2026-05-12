import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const tempFileManager = readFileSync('src/lib/utils/tempFileManager.ts', 'utf8');
const mainActivity = readFileSync(
  'android/app/src/main/java/com/brewguide/app/MainActivity.java',
  'utf8'
);
const pluginPath =
  'android/app/src/main/java/com/brewguide/app/BrewGuideGalleryPlugin.java';

assert.match(
  tempFileManager,
  /saveImageToAndroidGallery/,
  'Android gallery saves should use the native MediaStore saver before cache-file fallbacks'
);

assert.ok(
  existsSync(pluginPath),
  'Android should provide a native gallery saver plugin'
);

const galleryPlugin = readFileSync(pluginPath, 'utf8');

assert.match(
  galleryPlugin,
  /MediaStore\.Images\.Media\.RELATIVE_PATH/,
  'Native gallery saver should write into a public Pictures/BrewGuide MediaStore collection'
);

assert.match(
  galleryPlugin,
  /MediaStore\.MediaColumns\.IS_PENDING/,
  'Native gallery saver should mark MediaStore rows pending while bytes are written'
);

assert.match(
  galleryPlugin,
  /openOutputStream/,
  'Native gallery saver should stream image bytes into the MediaStore content URI'
);

assert.match(
  galleryPlugin,
  /MediaScannerConnection\.scanFile/,
  'Native gallery saver should request an immediate media scan after saving'
);

assert.match(
  mainActivity,
  /registerPlugin\(BrewGuideGalleryPlugin\.class\)/,
  'MainActivity should register the native gallery saver plugin'
);

console.log('bean print Android gallery save tests passed');
