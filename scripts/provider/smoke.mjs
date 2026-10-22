/** Shared-engine acceptance smoke. This supplements, not replaces, ContentResolver tests. */
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { exerciseExtendedFamilies } from './extendedSmoke.mjs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createContext, runInContext } from 'node:vm';
import { createHash, randomBytes } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
const temp = mkdtempSync(join(tmpdir(), 'brew-provider-'));
const db = new DatabaseSync(join(temp, 'test.db'));
const files = new Map();
const published = [];
let failPublish = false;
let deniedEntity = '';
let caller = 'caller-a';
const bundle = readFileSync(
  'android/app/src/main/assets/provider/business.js',
  'utf8'
);
const permissions = {
  allowWrite: true,
  allowDelete: true,
  grantedDomains: ['beans', 'notes', 'brewing', 'settings'],
};
function native(operation, payload) {
  const a = JSON.parse(payload);
  let result = null;
  switch (operation) {
    case 'sql.query':
      result = db.prepare(a.sql).all(...a.params);
      break;
    case 'sql.execute':
      result = { changes: Number(db.prepare(a.sql).run(...a.params).changes) };
      break;
    case 'sql.begin':
      db.exec('BEGIN IMMEDIATE');
      break;
    case 'sql.commit':
      db.exec('COMMIT');
      break;
    case 'sql.rollback':
      db.exec('ROLLBACK');
      break;
    case 'crypto.random':
      result = { bytes: [...randomBytes(a.length)] };
      break;
    case 'crypto.sha256':
      result = {
        hex: createHash('sha256')
          .update(Buffer.from(a.bytesBase64, 'base64'))
          .digest('hex'),
      };
      break;
    case 'permissions.checkChanges':
      if (a.changes.some(change => change.entity === deniedEntity))
        throw Error('Permission denied');
      break;
    case 'migration.canAdoptFresh':
      result = true;
      break;
    case 'context.identity':
      result = { namespace: caller };
      break;
    case 'events.publish':
      if (failPublish) throw Error('simulated publish interruption');
      published.push(a.changes);
      break;
    case 'files.write':
      assert(!files.has(a.relativePath));
      files.set(a.relativePath, a.dataBase64);
      break;
    case 'files.read':
      assert(files.has(a.relativePath));
      result = { base64: files.get(a.relativePath) };
      break;
    case 'files.delete':
      files.delete(a.relativePath);
      break;
    case 'files.exists':
      result = files.has(a.relativePath);
      break;
    case 'files.list':
      result = [...files.keys()].map(path => path.split('/').at(-1));
      break;
    // Test transport/persistence only. Real Android Bitmap codec is covered by instrumentation.
    case 'images.process':
      result = { compressed: a.dataUrl };
      break;
    default:
      throw Error(`Unexpected host operation ${operation}`);
  }
  return JSON.stringify(result);
}
function load() {
  const context = createContext({ __brewHost: { call: native } });
  runInContext(bundle, context);
  const api = context.BrewGuideProvider;
  assert.equal(JSON.parse(api.initialize()).ok, true);
  return api;
}
let api = load();
const attemptedTools = new Set();
const successfulTools = new Set();
function raw(name, args = {}, grants = permissions) {
  const scoped = { ...args };
  if (scoped.requestId) scoped.requestId = `${caller}:${scoped.requestId}`;
  attemptedTools.add(name);
  const result = JSON.parse(
    api.execute(name, JSON.stringify(scoped), JSON.stringify(grants))
  );
  if (result.ok) successfulTools.add(name);
  return result;
}
function call(name, args = {}, grants = permissions) {
  const response = raw(name, args, grants);
  assert.equal(response.ok, true, JSON.stringify(response));
  return response.result;
}
try {
  const catalog = JSON.parse(api.catalog());
  assert.equal(catalog.length, 80);
  assert.equal(new Set(catalog.map(t => t.name)).size, 80);
  assert(
    catalog.every(
      t => t.inputSchema && t._meta && Array.isArray(t.requiredDomains)
    )
  );
  assert.equal(call('get_capabilities').transport, 'Android ContentProvider');
  assert.equal(
    raw('list_beans', {}, { ...permissions, grantedDomains: [] }).error.code,
    'PERMISSION_DENIED'
  );
  assert.equal(
    raw(
      'create_bean',
      { requestId: 'denied-create', bean: { name: 'Denied' } },
      { ...permissions, allowWrite: false }
    ).error.code,
    'PERMISSION_DENIED'
  );
  const create = {
    requestId: 'create-bean-01',
    bean: {
      name: 'Provider test',
      capacityGrams: 100,
      remainingGrams: 100,
      blendComponents: [{ variety: ['SL28/34', 'Ruiru 11', 'Batian'] }],
    },
  };
  const bean = call('create_bean', create).bean;
  assert.equal(call('create_bean', create).replayed, true);
  assert.equal(call('list_beans').total, 1);
  const note = call('create_brew_note', {
    requestId: 'create-note-01',
    note: {
      beanId: bean.id,
      recordType: 'brew',
      coffeeGrams: 12,
      equipment: 'OREA',
      method: '三段式',
      rating: 4,
      taste: { acidity: 4, sweetness: 3, bitterness: 1.5, body: 4 },
    },
  }).note;
  assert.equal(call('get_bean', { id: bean.id }).bean.remainingGrams, 88);
  const updated = call('update_brew_note', {
    requestId: 'update-note-01',
    id: note.id,
    expectedVersion: note.version,
    changes: {
      coffeeGrams: 18,
      extractionTimeSeconds: 25,
      liquidWeightGrams: 36,
    },
  }).note;
  assert.equal(call('get_bean', { id: bean.id }).bean.remainingGrams, 82);
  assert.equal(
    raw('update_brew_note', {
      requestId: 'stale-note-01',
      id: note.id,
      expectedVersion: note.version,
      changes: { coffeeGrams: 19 },
    }).error.code,
    'CONFLICT'
  );
  const preview = call('preview_delete', { entity: 'brew_note', id: note.id });
  call('delete_brew_note', {
    requestId: 'delete-note-01',
    id: note.id,
    expectedVersion: updated.version,
    confirmationToken: preview.confirmationToken,
  });
  assert.equal(call('get_bean', { id: bean.id }).bean.remainingGrams, 100);
  assert.equal(
    raw('create_brew_note', {
      requestId: 'overdraw-note',
      note: { beanId: bean.id, coffeeGrams: 101 },
    }).ok,
    false
  );
  assert.equal(call('list_brew_notes').total, 0);
  const equipment = call('create_equipment', {
    requestId: 'create-equipment',
    equipment: { name: 'Provider brewer', animationType: 'v60' },
  }).equipment;
  assert(equipment.id);
  const grinder = call('create_grinder', {
    requestId: 'create-grinder',
    grinder: { name: 'Provider grinder', currentGrindSize: '12' },
  }).grinder;
  assert(grinder.id);
  const crossScopeNote = {
    requestId: 'denied-grinder-sideeffect',
    note: {
      beanId: bean.id,
      coffeeGrams: 10,
      grindSize: 'Provider grinder 20',
      equipment: 'V60',
      method: '三段式',
    },
  };
  deniedEntity = 'grinder';
  assert.equal(
    raw('create_brew_note', crossScopeNote).error.code,
    'PERMISSION_DENIED'
  );
  assert.equal(call('list_brew_notes').total, 0);
  assert.equal(call('get_bean', { id: bean.id }).bean.remainingGrams, 100);
  assert.equal(
    db
      .prepare('SELECT COUNT(*) AS n FROM mcp_operations WHERE request_id = ?')
      .get(`${caller}:${crossScopeNote.requestId}`).n,
    0
  );
  deniedEntity = '';
  const retriedNote = call('create_brew_note', crossScopeNote).note;
  const retriedPreview = call('preview_delete', {
    entity: 'brew_note',
    id: retriedNote.id,
  });
  call('delete_brew_note', {
    requestId: 'delete-crossscope-note',
    id: retriedNote.id,
    expectedVersion: retriedNote.version,
    confirmationToken: retriedPreview.confirmationToken,
  });
  assert.equal(call('get_bean', { id: bean.id }).bean.remainingGrams, 100);
  const png =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
  const current = call('get_bean', { id: bean.id }).bean;
  deniedEntity = 'bean';
  assert.equal(
    raw('set_bean_image', {
      requestId: 'denied-image-01',
      id: bean.id,
      expectedVersion: current.version,
      expectedImageVersion: current.imageVersion,
      side: 'front',
      dataUrl: png,
    }).error.code,
    'PERMISSION_DENIED'
  );
  assert.equal(files.size, 0);
  deniedEntity = '';
  const imaged = call('set_bean_image', {
    requestId: 'set-image-01',
    id: bean.id,
    expectedVersion: current.version,
    expectedImageVersion: current.imageVersion,
    side: 'front',
    dataUrl: png,
  }).bean;
  assert.equal(imaged.images.length, 1);
  assert(files.size >= 1);
  assert(
    call('get_bean_image', { id: bean.id, imageId: imaged.images[0].imageId })
  );
  const imagePreview = call('preview_delete', {
    entity: 'bean_image',
    id: bean.id,
    side: 'front',
  });
  call('delete_bean_image', {
    requestId: 'delete-image-01',
    id: bean.id,
    expectedVersion: imaged.version,
    side: 'front',
    confirmationToken: imagePreview.confirmationToken,
  });
  assert.equal(files.size, 0);
  caller = 'caller-b';
  assert.equal(call('list_mcp_activity').items.length, 0);
  caller = 'caller-a';
  assert(call('list_mcp_activity').items.length > 0);
  failPublish = true;
  const warning = call('create_bean', {
    requestId: 'outbox-recovery',
    bean: { name: 'Outbox test' },
  });
  assert(warning.notificationWarning);
  assert(db.prepare('SELECT count(*) AS n FROM mcp_publications').get().n > 0);
  failPublish = false;
  api = load();
  assert.equal(
    db.prepare('SELECT count(*) AS n FROM mcp_publications').get().n,
    0
  );
  assert.equal(call('create_bean', create).replayed, true);
  assert.equal(call('list_beans').total, 2);
  exerciseExtendedFamilies(call, { bean, equipment, png });
  const coverage = {
    catalog: catalog.map(tool => tool.name).sort(),
    attempted: [...attemptedTools].sort(),
    succeeded: [...successfulTools].sort(),
    unexercised: catalog
      .map(tool => tool.name)
      .filter(name => !successfulTools.has(name))
      .sort(),
  };
  assert.deepEqual(coverage.unexercised, []);
  if (process.env.PROVIDER_COVERAGE_PATH)
    writeFileSync(
      process.env.PROVIDER_COVERAGE_PATH,
      JSON.stringify(coverage, null, 2)
    );
  console.warn(
    `Compiled Node engine successful tool coverage: ${successfulTools.size}/80; remaining: ${coverage.unexercised.join(', ')}`
  );
  console.warn(
    'Provider shared-engine smoke passed: all 80 tools, scopes, canonical fields, inventory closure, retries, conflict, rollback, catalog, image persistence, caller audit isolation, precommit scope denial/rollback, durable publication/restart.'
  );
} finally {
  db.close();
  rmSync(temp, { recursive: true, force: true });
}
