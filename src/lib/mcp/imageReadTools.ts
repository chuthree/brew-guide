import type { SqliteExecutor } from '@/lib/data/sqlite/driver';
import type { NativeImageFileStore } from '@/lib/data/images/nativeImageFileStore';
import { createTauriImageFileStore } from '@/lib/data/images/tauriImageFileStore';
import { readStoredImageSource } from '@/lib/data/images/storedImageSourceReader';
import {
  listCoffeeBeanImageMetadata,
  listBrewingNoteImageMetadata,
} from '@/lib/data/sqlite/imageMetadataExecutor';
import { getCoffeeBean } from '@/lib/data/sqlite/repositories/coffeeBean';
import { getBrewingNote } from '@/lib/data/sqlite/repositories/brewingNote';
import {
  MCP_BEAN_IMAGE_MAX_BYTES,
  validateMcpBeanImageDataUrl,
} from './beanImageTools';
import { McpToolError, validate } from './validation';
import type { Schema } from './toolDefinitions';
const schema: Schema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    id: { type: 'string', minLength: 1, maxLength: 128 },
    imageId: { type: 'string', minLength: 1, maxLength: 128 },
  },
  required: ['id', 'imageId'],
};
export const imageReadDefinitions = [
  {
    name: 'get_bean_image',
    description:
      'Explicitly read the original pixels for one bean photo using its imageId from get_bean. Returns bounded PNG/JPEG/WebP pixels or an opaque binary resource for legacy managed formats (at most 8 MiB); no filesystem paths or external URLs. Does not fetch remote photos. Ordinary lists and activity never include pixels.',
    schema,
  },
  {
    name: 'get_brew_note_image',
    description:
      'Explicitly read the original pixels for one note photo using its imageId from get_brew_note. Returns bounded PNG/JPEG/WebP pixels or an opaque binary resource for legacy managed formats (at most 8 MiB); no filesystem paths or external URLs. Does not fetch remote photos. Ordinary lists and activity never include pixels.',
    schema,
  },
];
/** Explicit authenticated/domain-authorized read only; never called by list projections. */
export async function readImageTool(
  tx: SqliteExecutor,
  name: string,
  args: Record<string, unknown>,
  fileStore?: NativeImageFileStore
) {
  if (!imageReadDefinitions.some(definition => definition.name === name))
    throw new McpToolError('UNKNOWN_TOOL', 'Unknown image read tool.');
  validate(args, schema);
  const id = args.id as string;
  const bean = name === 'get_bean_image';
  const owner = bean
    ? await getCoffeeBean(tx, id)
    : await getBrewingNote(tx, id);
  if (!owner)
    throw new McpToolError(
      'NOT_FOUND',
      'The requested photo owner does not exist.'
    );
  const rows = bean
    ? await listCoffeeBeanImageMetadata(tx, id)
    : await listBrewingNoteImageMetadata(tx, id);
  const row = rows.find(
    candidate =>
      candidate.imageId === args.imageId && candidate.variant === 'original'
  );
  if (!row)
    throw new McpToolError(
      'NOT_FOUND',
      'This original photo does not belong to the requested record.'
    );
  const handle = {
    imageId: row.imageId,
    ...('slot' in row ? { side: row.slot } : { position: row.position }),
  };
  if (row.sourceKind === 'external')
    return { image: { ...handle, status: 'external-unavailable' as const } };
  if (row.sizeBytes > MCP_BEAN_IMAGE_MAX_BYTES)
    return {
      image: {
        ...handle,
        status: 'size-limit' as const,
        maxSizeBytes: MCP_BEAN_IMAGE_MAX_BYTES,
      },
    };
  try {
    const dataUrl = await readStoredImageSource(
      row,
      fileStore ?? (await createTauriImageFileStore())
    );
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(row.mimeType)) {
      return {
        image: {
          ...handle,
          status: 'opaque' as const,
          mimeType: 'application/octet-stream',
          originalMimeType: row.mimeType,
          sizeBytes: row.sizeBytes,
          blob: dataUrl.slice(dataUrl.indexOf(',') + 1),
        },
      };
    }
    const decoded = validateMcpBeanImageDataUrl(dataUrl);
    return {
      image: {
        ...handle,
        status: 'available' as const,
        mimeType: decoded.mimeType,
        sizeBytes: decoded.bytes.length,
        width: decoded.width,
        height: decoded.height,
        dataUrl,
      },
    };
  } catch {
    throw new McpToolError(
      'IMAGE_UNAVAILABLE',
      'The stored photo could not be read safely. No file paths or image data are included in this error.'
    );
  }
}
