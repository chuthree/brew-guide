import type { BrewingNote } from '@/lib/core/config';
import type { SqliteExecutor } from '@/lib/data/sqlite/driver';
import type { NativeImageFileStore } from '@/lib/data/images/nativeImageFileStore';
import { createTauriImageFileStore } from '@/lib/data/images/tauriImageFileStore';
import { listBrewingNoteImageMetadata } from '@/lib/data/sqlite/imageMetadataExecutor';
import {
  prepareBrewingNoteImageWrite,
  type PreparedBrewingNoteImageWrite,
  type SqliteBrewingNotePersistenceOptions,
  type BrewingNoteImageSelection,
} from '@/lib/data/sqlite/persistence/brewingNoteImagePersistence';
import { NOTE_IMAGE_COMPRESSION_OPTIONS } from '@/lib/images/imageProcessing';
import {
  compressMcpImageDataUrl,
  validateMcpBeanImageDataUrl,
  MCP_BEAN_IMAGE_MAX_BYTES,
  type McpBeanImageDependencies,
} from './beanImageTools';
import { McpToolError } from './validation';

export const MCP_NOTE_IMAGE_LIMIT = 9;
export type McpNoteImageOperation =
  | { kind: 'append'; dataUrls: string[] }
  | { kind: 'replace'; imageId: string; dataUrl: string }
  | { kind: 'remove'; imageId: string }
  | { kind: 'reorder'; imageIds: string[] };
export interface McpNoteImageDependencies {
  fileStore?: NativeImageFileStore;
  process?: McpBeanImageDependencies['process'];
  persistence?: SqliteBrewingNotePersistenceOptions;
}

/** Within the MCP transaction, prepare files then register created paths before apply(). */
export async function prepareMcpNoteImageMutation(
  tx: SqliteExecutor,
  note: BrewingNote,
  operation: McpNoteImageOperation,
  dependencies: McpNoteImageDependencies = {}
): Promise<PreparedBrewingNoteImageWrite> {
  const rows = await listBrewingNoteImageMetadata(tx, note.id);
  const originals = rows
    .filter(row => row.variant === 'original')
    .sort((a, b) => a.position - b.position);
  let selection: BrewingNoteImageSelection;
  if (operation.kind === 'remove' || operation.kind === 'replace') {
    if (!originals.some(row => row.imageId === operation.imageId))
      throw new McpToolError('NOT_FOUND', 'This note photo does not exist.');
  }
  if (operation.kind === 'append' || operation.kind === 'replace') {
    const inputs =
      operation.kind === 'append' ? operation.dataUrls : [operation.dataUrl];
    if (
      !inputs.length ||
      inputs.length > MCP_NOTE_IMAGE_LIMIT ||
      (operation.kind === 'append' &&
        originals.length + inputs.length > MCP_NOTE_IMAGE_LIMIT)
    )
      throw new McpToolError(
        'INVALID_ARGUMENT',
        'A note can contain at most nine photos; supply at least one new photo.'
      );
    let bytes = 0;
    for (const image of inputs) {
      bytes += validateMcpBeanImageDataUrl(image).bytes.length;
      if (bytes > MCP_BEAN_IMAGE_MAX_BYTES)
        throw new McpToolError(
          'INVALID_ARGUMENT',
          'Combined incoming note photos must not exceed 8 MiB.'
        );
    }
    const compressed: string[] = [];
    for (const image of inputs)
      compressed.push(
        await compressMcpImageDataUrl(
          image,
          NOTE_IMAGE_COMPRESSION_OPTIONS,
          dependencies.process
        )
      );
    selection =
      operation.kind === 'append'
        ? { appendImages: compressed }
        : {
            replaceImage: { imageId: operation.imageId, image: compressed[0] },
          };
  } else if (operation.kind === 'remove')
    selection = {
      imageIds: originals
        .filter(row => row.imageId !== operation.imageId)
        .map(row => row.imageId),
    };
  else if (operation.kind === 'reorder') {
    if (
      operation.imageIds.length !== originals.length ||
      new Set(operation.imageIds).size !== originals.length ||
      operation.imageIds.some(id => !originals.some(row => row.imageId === id))
    )
      throw new McpToolError(
        'INVALID_ARGUMENT',
        'Provide each existing note photo ID exactly once.'
      );
    selection = { imageIds: operation.imageIds };
  } else
    throw new McpToolError('INVALID_ARGUMENT', 'Unknown note image operation.');
  try {
    return await prepareBrewingNoteImageWrite(
      tx,
      dependencies.fileStore ?? (await createTauriImageFileStore()),
      note,
      dependencies.persistence,
      selection
    );
  } catch {
    throw new McpToolError(
      'IMAGE_STORAGE_ERROR',
      'Image storage preparation failed; no note or image metadata was changed.'
    );
  }
}

/** Safe photo handles, not filesystem paths, source URLs or image bytes. */
export async function getMcpNoteImageInfo(tx: SqliteExecutor, noteId: string) {
  const rows = await listBrewingNoteImageMetadata(tx, noteId);
  return rows
    .filter(row => row.variant === 'original')
    .sort((a, b) => a.position - b.position)
    .map(row => ({
      imageId: row.imageId,
      position: row.position,
      source: row.sourceKind,
      mimeType: row.sourceKind === 'file' ? row.mimeType : null,
      sizeBytes: row.sourceKind === 'file' ? row.sizeBytes : null,
      hasThumbnail: rows.some(
        other =>
          other.position === row.position && other.variant === 'thumbnail'
      ),
    }));
}
