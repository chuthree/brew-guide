import {
  getAppSettings,
  saveAppSettings,
} from '@/lib/data/sqlite/repositories/appSettings';
import { nanoid } from 'nanoid';
import type { CoffeeBean } from '@/types/app';
import type { BrewingNote } from '@/lib/core/config';
import type { SqliteExecutor } from '@/lib/data/sqlite/driver';
import {
  getCoffeeBean,
  listCoffeeBeans,
  saveCoffeeBean,
  deleteCoffeeBean,
} from '@/lib/data/sqlite/repositories/coffeeBean';
import {
  listBrewingNotes,
  saveBrewingNote,
  deleteBrewingNote,
} from '@/lib/data/sqlite/repositories/brewingNote';
import { stripCoffeeBeanImages } from '@/lib/coffee-beans/imageRecords';
import { stripBrewingNoteImages } from '@/lib/notes/imageRecords';
import {
  analyzeHistoricalConversion,
  buildHistoricalConversionRecords,
  conversionAmount,
  conversionGrams,
} from '@/lib/coffee-beans/historicalConversion';
export { beanConversionDefinitions } from './beanConversionDefinitions';
import { invalid, McpToolError, recordVersion } from './validation';
import {
  localHistoryGeneration,
  type MutationChange,
  type MutationWork,
} from './storage';
type Args = Record<string, unknown>;
const previews = new Map<
  string,
  {
    id: string;
    fingerprint: string;
    version: string;
    generation: number;
    expiresAt: number;
    groupMigration?: unknown;
  }
>();
const fmt = conversionAmount;
const grams = conversionGrams;
async function graph(tx: SqliteExecutor, id: string) {
  const original = await getCoffeeBean(tx, id);
  if (!original) throw new McpToolError('NOT_FOUND', 'Coffee bean not found');
  const analyzed = analyzeHistoricalConversion(
    original,
    await listCoffeeBeans(tx),
    await listBrewingNotes(tx)
  );
  const {
    related,
    records,
    brews,
    capacity,
    remaining,
    input,
    usage,
    discardedMetadataFields,
  } = analyzed;
  const settings = await getAppSettings(tx);
  const affectedGroups = (settings?.coffeeBeanGroups ?? []).filter(group =>
    group.beanIds.includes(id)
  );
  const beanImages = await tx.query(
    'SELECT * FROM coffee_bean_images WHERE bean_id=? ORDER BY image_id',
    [id]
  );
  const noteImages = [];
  for (const note of related)
    noteImages.push(
      ...(await tx.query(
        'SELECT * FROM brewing_note_images WHERE note_id=? ORDER BY image_id',
        [note.id]
      ))
    );
  const fingerprint = await recordVersion({
    original,
    related,
    beanImages,
    noteImages,
    affectedGroups,
  });
  return {
    original,
    related,
    records,
    brews,
    capacity,
    remaining,
    input,
    usage,
    beanImages,
    noteImages,
    fingerprint,
    discardedMetadataFields,
    settings,
    affectedGroups,
  };
}
async function beanView(bean: CoffeeBean) {
  return {
    ...stripCoffeeBeanImages(bean),
    version: await recordVersion(bean),
    capacityGrams: grams(bean.capacity, 'Capacity'),
    remainingGrams: grams(bean.remaining, 'Remaining'),
  };
}
async function noteView(note: BrewingNote) {
  return {
    ...stripBrewingNoteImages(note),
    version: await recordVersion(note),
  };
}
export async function readBeanConversionTool(
  tx: SqliteExecutor,
  name: string,
  args: Args
): Promise<Args> {
  if (name !== 'preview_convert_roasted_to_green')
    throw new McpToolError('UNKNOWN_TOOL', 'Unknown conversion read');
  const g = await graph(tx, String(args.id));
  const version = await recordVersion(g.original);
  const token = nanoid();
  const expiresAt = Date.now() + 300_000;
  for (const [key, value] of previews)
    if (
      value.expiresAt < Date.now() ||
      value.generation !== localHistoryGeneration
    )
      previews.delete(key);
  if (previews.size >= 1000) previews.delete(previews.keys().next().value!);
  previews.set(token, {
    id: g.original.id,
    fingerprint: g.fingerprint,
    version,
    generation: localHistoryGeneration,
    expiresAt,
    groupMigration: args.groupMigration,
  });
  return {
    version,
    graphVersion: g.fingerprint,
    linkedNoteVersions: await Promise.all(
      g.related.map(async note => ({
        id: note.id,
        version: await recordVersion(note),
      }))
    ),
    confirmationToken: token,
    expiresAt,
    originalBean: await beanView(g.original),
    impact: {
      deleteOriginalBean: true,
      replacedIdentityAndTimestamp: true,
      affectedGroups: await Promise.all(
        g.affectedGroups.map(async group => ({
          id: group.id,
          name: group.name,
          version: await recordVersion(group),
        }))
      ),
      groupMigration: args.groupMigration ?? null,
      groupMigrationOptions:
        g.input > 0 ? ['green', 'roasted', 'remove'] : ['green', 'remove'],
      groupPolicyNotice:
        'Grouped beans require a preview with explicit groupMigration and the same policy on confirmation.',
      discardedMetadataFields: g.discardedMetadataFields,
      metadataPolicy:
        'Canonical app migration copies core bean metadata only; review discardedMetadataFields before confirming.',
      deletedRecordIds: g.records.map(n => n.id),
      migratedNoteIds: g.brews.map(n => n.id),
      greenCapacityGrams: g.capacity,
      greenRemainingGrams: g.remaining,
      roastedInputGrams: g.input,
      roastedCapacityGrams: g.input,
      roastedRemainingGrams: Number(fmt(g.input - g.usage)),
      directConversion: g.input === 0,
      preservedBeanImageCount: g.beanImages.length,
      preservedOrdinaryNoteImages: true,
      deletedRecordImageCount: g.noteImages.filter(row =>
        g.records.some(note => note.id === row.note_id)
      ).length,
    },
    requiredConfirmation: 'convert_roasted_to_green',
  };
}
export async function mutateBeanConversionTool(
  tx: SqliteExecutor,
  name: string,
  args: Args
): Promise<MutationWork<Args>> {
  if (name !== 'convert_roasted_to_green')
    throw new McpToolError('UNKNOWN_TOOL', 'Unknown conversion mutation');
  const p = previews.get(String(args.confirmationToken));
  if (
    args.confirmAction !== 'convert_roasted_to_green' ||
    !p ||
    p.id !== args.id ||
    p.version !== args.expectedVersion ||
    p.expiresAt < Date.now() ||
    p.generation !== localHistoryGeneration
  )
    throw new McpToolError(
      'CONFIRMATION_REQUIRED',
      'Present a fresh conversion preview and explicitly confirm its action'
    );
  const g = await graph(tx, p.id);
  if (g.fingerprint !== p.fingerprint)
    throw new McpToolError(
      'CONFLICT',
      'The bean, linked records or photos changed after preview'
    );
  if (
    g.affectedGroups.length &&
    (!['green', 'roasted', 'remove'].includes(String(args.groupMigration)) ||
      args.groupMigration !== p.groupMigration)
  )
    throw new McpToolError(
      'CONFIRMATION_REQUIRED',
      'Preview again with an explicit groupMigration policy, then confirm that same policy'
    );
  if (
    g.affectedGroups.length &&
    args.groupMigration === 'roasted' &&
    g.input === 0
  )
    invalid(
      'Unused direct conversion has no roasted output to receive group membership'
    );
  const o = g.original;
  const { green, roasted, roastNote, migratedNotes, timestamp } =
    buildHistoricalConversionRecords(g, Date.now(), nanoid);
  const changes: MutationChange[] = [];
  for (const bean of [green, ...(roasted ? [roasted] : [])]) {
    await saveCoffeeBean(tx, bean);
    // Immutable object files may have multiple references. All app/MCP cleanup
    // checks both image tables before deletion. Copy metadata, not file bytes.
    for (const row of g.beanImages) {
      const copy = {
        ...row,
        image_id: nanoid(),
        bean_id: bean.id,
        updated_at_ms: timestamp,
      };
      const keys = Object.keys(copy);
      await tx.execute(
        `INSERT INTO coffee_bean_images (${keys.join(',')}) VALUES (${keys.map(() => '?').join(',')})`,
        Object.values(copy)
      );
    }
    changes.push({
      entity: 'bean',
      id: bean.id,
      before: null,
      after: await beanView(bean),
    });
  }
  for (const note of g.brews) {
    const after = migratedNotes.find(item => item.id === note.id)!;
    await saveBrewingNote(tx, after);
    changes.push({
      entity: 'brew_note',
      id: note.id,
      before: await noteView(note),
      after: await noteView(after),
    });
  }
  const cleanupPaths: string[] = [];
  for (const note of g.records) {
    for (const row of g.noteImages)
      if (row.note_id === note.id && typeof row.relative_path === 'string')
        cleanupPaths.push(row.relative_path);
    await tx.execute('DELETE FROM brewing_note_images WHERE note_id=?', [
      note.id,
    ]);
    await deleteBrewingNote(tx, note.id);
    changes.push({
      entity: 'brew_note',
      id: note.id,
      before: await noteView(note),
      after: null,
    });
  }
  if (roastNote) {
    await saveBrewingNote(tx, roastNote);
    changes.push({
      entity: 'brew_note',
      id: roastNote.id,
      before: null,
      after: await noteView(roastNote),
    });
  }
  if (g.affectedGroups.length && g.settings) {
    const target =
      args.groupMigration === 'green'
        ? green.id
        : args.groupMigration === 'roasted'
          ? roasted!.id
          : undefined;
    const oldGroups = g.settings.coffeeBeanGroups!;
    const nextGroups = oldGroups.map(group =>
      group.beanIds.includes(o.id)
        ? {
            ...group,
            beanIds: [
              ...new Set(
                group.beanIds.flatMap(id =>
                  id === o.id ? (target ? [target] : []) : [id]
                )
              ),
            ],
            updatedAt: timestamp,
          }
        : group
    );
    await saveAppSettings(tx, { ...g.settings, coffeeBeanGroups: nextGroups });
    changes.push({
      entity: 'settings',
      id: 'main',
      before: { coffeeBeanGroups: oldGroups },
      after: { coffeeBeanGroups: nextGroups },
    });
  }
  await tx.execute('DELETE FROM coffee_bean_images WHERE bean_id=?', [o.id]);
  await deleteCoffeeBean(tx, o.id);
  changes.push({
    entity: 'bean',
    id: o.id,
    before: await beanView(o),
    after: null,
  });
  return {
    result: {
      greenBean: await beanView(green),
      newRoastedBean: roasted ? await beanView(roasted) : null,
      roastingNote: roastNote ? await noteView(roastNote) : null,
      migratedNotesCount: g.brews.length,
      deletedRecordsCount: g.records.length,
      deletedOriginalBeanId: o.id,
      discardedMetadataFields: g.discardedMetadataFields,
      migratedGroupIds: g.affectedGroups.map(group => group.id),
      groupMigration: args.groupMigration ?? null,
      deletedRecordIds: g.records.map(n => n.id),
      migratedNoteIds: g.brews.map(n => n.id),
    },
    changes,
    cleanupPaths,
    summary: `熟豆历史转换为生豆：${o.name}`,
  };
}
