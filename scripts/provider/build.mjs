import { build } from 'esbuild';
import { transformAsync } from '@babel/core';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
const root = process.cwd();
const headless = resolve(root, 'src/lib/provider/headless');
const aliases = {
  '@/lib/data/sqlite/tauriSqliteDriver': `${headless}/sqlite.ts`,
  '@/lib/data/images/tauriImageFileStore': `${headless}/images.ts`,
  '@/lib/images/imageProcessing': `${headless}/imageProcessing.ts`,
  '@/lib/images/thumbnail': `${headless}/thumbnail.ts`,
  '@/lib/stores/settingsStore': `${headless}/settings.ts`,
  '@/lib/data/mutationCoordinator': `${headless}/mutation.ts`,
  ...Object.fromEntries(
    [
      'coffeeBeanStore',
      'brewingNoteStore',
      'customEquipmentStore',
      'customMethodStore',
      'grinderStore',
    ].map(name => [`@/lib/stores/${name}`, `${headless}/unavailableUi.ts`])
  ),
  '@/lib/data/repositories': `${headless}/unavailableUi.ts`,
  '@/lib/app/dataIntegrity': `${headless}/unavailableUi.ts`,
  nanoid: `${headless}/nanoid.ts`,
};
const result = await build({
  entryPoints: [`${headless}/entry.ts`],
  bundle: true,
  write: false,
  platform: 'browser',
  format: 'iife',
  globalName: 'BrewGuideProvider',
  target: 'es2017',
  alias: aliases,
  define: { window: 'undefined' },
  minifySyntax: true,
  metafile: true,
});
const included = Object.entries(
  Object.values(result.metafile.outputs)[0].inputs
)
  .filter(([, v]) => v.bytesInOutput > 0)
  .map(([p]) => p);
const forbidden = included.filter(p =>
  /react|zustand|dexie|capacitor|@tauri-apps|lib\/stores\//.test(p)
);
if (forbidden.length)
  throw Error(
    `Headless bundle pulled UI/platform modules: ${forbidden.join(', ')}`
  );
const output = await transformAsync(result.outputFiles[0].text, {
  presets: [
    [
      '@babel/preset-env',
      {
        targets: { ie: '11' },
        modules: false,
        useBuiltIns: 'usage',
        corejs: '3.51',
      },
    ],
  ],
  comments: false,
  compact: true,
  sourceMaps: false,
});
// Babel derives polyfills from the entire shared engine, including dependencies.
// Bundle those ES5 modules afterward; do not load unrelated browser API shims.
const linked = await build({
  stdin: {
    contents:
      output.code + '\nglobalThis.BrewGuideProvider = BrewGuideProvider;',
    resolveDir: root,
    loader: 'js',
  },
  bundle: true,
  write: false,
  platform: 'browser',
  format: 'iife',
  target: 'es5',
  minify: true,
  metafile: true,
  plugins: [
    {
      name: 'rhino-bind-compatibility',
      setup(bundler) {
        // Rhino 1.8 nested native bind is unreliable for core-js uncurry adapters.
        // Select core-js's maintained call.apply fallback, not a global bind patch.
        bundler.onLoad(
          { filter: /core-js\/internals\/function-bind-native\.js$/ },
          () => ({
            contents: 'module.exports = false;',
            loader: 'js',
          })
        );
      },
    },
  ],
});
const inputs = [
  ...new Set([
    ...Object.keys(result.metafile.inputs),
    ...Object.keys(linked.metafile.inputs).filter(p => p !== '<stdin>'),
  ]),
].sort();
const banner = `var globalThis=this;var window;var Promise=undefined;var __brewQueue=[];function queueMicrotask(fn){__brewQueue.push(fn);}function setTimeout(fn){__brewQueue.push(fn);return __brewQueue.length;}function clearTimeout(){}function setImmediate(fn){__brewQueue.push(fn);return __brewQueue.length;}function clearImmediate(){}function __brewDrain(){if(!__brewQueue.length)return false;var q=__brewQueue.splice(0);for(var i=0;i<q.length;i++)q[i]();return true;}\n`;
const target = resolve(root, 'android/app/src/main/assets/provider');
await mkdir(target, { recursive: true });
await writeFile(
  `${target}/business.js`,
  banner + linked.outputFiles[0].text + '\n'
);
await writeFile(
  `${target}/business.inputs.json`,
  JSON.stringify(inputs, null, 2) + '\n'
);
console.warn(
  `Provider bundle: ${Buffer.byteLength(banner + linked.outputFiles[0].text)} bytes; ${inputs.length} shared inputs.`
);
