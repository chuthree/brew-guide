import assert from 'node:assert/strict';
import { test } from 'node:test';
import { verifyReleaseRuntime } from './verify-release-runtime.mjs';

const names = [
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
];
const mapping = names
  .map(
    name =>
      `org.mozilla.javascript.${name} -> org.mozilla.javascript.${name}:\n    int flags -> flags`
  )
  .join('\n');

test('retained reflection and serialized classes pass', () => {
  assert.equal(
    verifyReleaseRuntime(mapping, 'unrelated.RemovedClass'),
    names.length
  );
});
test('Android-generated lambda adapters may be optimized', () => {
  assert.equal(
    verifyReleaseRuntime(
      mapping +
        '\norg.mozilla.javascript.Context$$ExternalSyntheticLambda0 -> org.mozilla.javascript.a:\n    int capture -> a',
      ''
    ),
    names.length
  );
});
test('empty initializers and generated interface markers may be removed', () => {
  assert.equal(
    verifyReleaseRuntime(
      mapping,
      'org.mozilla.javascript.Context:\n    static void <clinit>()\norg.mozilla.javascript.Interpreter-IA'
    ),
    names.length
  );
});
test('the observed release VMBridge rename is rejected', () => {
  assert.throws(
    () =>
      verifyReleaseRuntime(
        mapping.replace(
          'VMBridge -> org.mozilla.javascript.VMBridge:',
          'VMBridge -> z2.d:'
        ),
        ''
      ),
    /Rhino class renamed/
  );
});
test('a missing reflective bridge is rejected', () => {
  assert.throws(
    () =>
      verifyReleaseRuntime(
        mapping.replace(
          /^org.mozilla.javascript.jdk18.VMBridge_jdk18.*\n    int flags -> flags\n/m,
          ''
        ),
        ''
      ),
    /Required Rhino runtime class missing/
  );
});
test('serialized field renames and removed members are rejected', () => {
  assert.throws(
    () =>
      verifyReleaseRuntime(mapping.replace('flags -> flags', 'flags -> a'), ''),
    /serialized field renamed/
  );
  assert.throws(
    () =>
      verifyReleaseRuntime(
        mapping,
        'org.mozilla.javascript.InterpreterData:\n    int flags'
      ),
    /member was removed/
  );
});
