import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Reflection and Java serialization are invisible to the Android shrinker.
// Check its actual output, not merely the presence of a keep rule in source.
const required = [
  'VMBridge',
  'jdk18.VMBridge_jdk18',
  'Context',
  'Script',
  'InterpretedFunction',
  'InterpreterData',
  'ScriptableObject',
  'NativeFunction',
  'BaseFunction',
  'UniqueTag',
  'regexp.RECompiled',
  'regexp.RECharSet',
].map(name => `org.mozilla.javascript.${name}`);

export function verifyReleaseRuntime(mapping, usage) {
  const retained = new Set();
  let rhino = false;
  for (const line of mapping.split(/\r?\n/)) {
    const type = /^(\S+) -> (\S+):$/.exec(line);
    if (type) {
      // D8-generated lambda adapters do not exist in the compiler's JVM graph.
      // They are not reflective names or serialized descriptors and may be renamed.
      rhino =
        type[1].startsWith('org.mozilla.javascript.') &&
        !type[1].includes('$$ExternalSynthetic');
      if (rhino) {
        assert.equal(type[2], type[1], `Rhino class renamed: ${type[1]}`);
        retained.add(type[1]);
      }
    } else if (rhino && /^\s+\S/.test(line) && !line.trim().startsWith('#')) {
      const member = line.trim().split(' -> ');
      if (member.length === 2 && !member[0].includes('(')) {
        const field = member[0].split(/\s+/).at(-1);
        assert.equal(
          member[1],
          field,
          `Rhino serialized field renamed: ${field}`
        );
      }
    }
  }
  for (const name of required)
    assert.ok(
      retained.has(name),
      `Required Rhino runtime class missing: ${name}`
    );
  let removedType = null;
  for (const line of usage.split(/\r?\n/)) {
    if (line && !/^\s/.test(line)) {
      // Ignore D8-generated adapters (including its non-Java "-IA" markers).
      removedType =
        /^org\.mozilla\.javascript\.[\w.$]+:?$/.test(line) &&
        !line.includes('$$ExternalSynthetic')
          ? line
          : null;
      if (removedType)
        assert.ok(line.endsWith(':'), `Rhino class was removed: ${line}`);
    } else if (removedType && line.trim()) {
      // R8 can drop an empty static initializer even for a kept class.
      assert.ok(
        line.trim() === 'static void <clinit>()',
        `Rhino member was removed: ${removedType} ${line.trim()}`
      );
    }
  }
  return retained.size;
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const directory = resolve(
    process.argv[2] ?? 'android/app/build/outputs/mapping/release'
  );
  const count = verifyReleaseRuntime(
    readFileSync(`${directory}/mapping.txt`, 'utf8'),
    readFileSync(`${directory}/usage.txt`, 'utf8')
  );
  process.stdout.write(
    `Release Rhino reflection/serialization contract verified: ${count} retained classes.\n`
  );
}
