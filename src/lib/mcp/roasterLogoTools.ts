import { decodeImageDataUrl } from '@/lib/data/images/imageBinary';
import { nanoid } from 'nanoid';
import type { AppSettings, RoasterConfig } from '@/lib/data/models';
import type { SqliteExecutor } from '@/lib/data/sqlite/driver';
import {
  getAppSettings,
  saveAppSettings,
} from '@/lib/data/sqlite/repositories/appSettings';
import { ROASTER_LOGO_COMPRESSION_OPTIONS } from '@/lib/images/imageProcessing';
import { normalizeCoffeeBeanRoaster } from '@/lib/utils/coffeeBeanUtils';
import {
  MCP_BEAN_IMAGE_MAX_BYTES,
  MCP_BEAN_IMAGE_MAX_DATA_URL_LENGTH,
  compressMcpImageDataUrl,
  validateMcpBeanImageDataUrl,
  type McpBeanImageDependencies,
} from './beanImageTools';
import { localHistoryGeneration, type MutationWork } from './storage';
import { invalid, McpToolError, recordVersion, validate } from './validation';
import type { Schema } from './toolDefinitions';

type Args = Record<string, unknown>;
const obj = (
  properties: Record<string, Schema>,
  required = Object.keys(properties)
): Schema => ({
  type: 'object',
  properties,
  required,
  additionalProperties: false,
});
const roasterName: Schema = { type: 'string', minLength: 1, maxLength: 128 };
const version: Schema = { type: 'string', minLength: 64, maxLength: 64 };
const write = {
  roasterName,
  requestId: { type: 'string', minLength: 8, maxLength: 128 } as Schema,
  expectedVersion: version,
};
export const MCP_ROASTER_LOGO_MAX_BYTES = 5 * 1024 * 1024;
export const roasterLogoDefinitions = [
  {
    name: 'get_roaster_logo',
    description:
      'Read safe logo metadata and version for a roaster, including a roaster with no configured logo. Returns validated inline raster content (maximum 8 MiB) only when includeImage is explicitly true; never returns remote URLs, paths or private settings.',
    schema: obj({ roasterName, includeImage: { type: 'boolean' } }, [
      'roasterName',
    ]),
  },
  {
    name: 'set_roaster_logo',
    description:
      'Create or replace a roaster logo using inline PNG/JPEG/WebP only (5 MiB source maximum); applies original-app 0.12 MiB/512px compression and preserves taste windows.',
    write: true,
    schema: obj({
      ...write,
      image: {
        type: 'string',
        minLength: 1,
        maxLength: Math.ceil(MCP_ROASTER_LOGO_MAX_BYTES / 3) * 4 + 32,
      },
    }),
  },
  {
    name: 'preview_delete_roaster_logo',
    description:
      'Preview removal of only a roaster logo, preserving taste windows and other configuration.',
    schema: obj({ roasterName }),
  },
  {
    name: 'delete_roaster_logo',
    description:
      'Remove only the previewed logo, preserving the roaster configuration and taste windows.',
    write: true,
    destructive: true,
    schema: obj({ ...write, confirmationToken: version }),
  },
];
const previews = new Map<
  string,
  { name: string; version: string; expires: number; generation: number }
>();
function checkedName(args: Args): string {
  const name = normalizeCoffeeBeanRoaster(String(args.roasterName));
  if (!name) invalid('roasterName must be non-empty');
  return name;
}
async function settingsAt(tx: SqliteExecutor): Promise<AppSettings> {
  const existing = await getAppSettings(tx);
  if (existing) return existing;
  const { defaultSettings } = await import('@/lib/stores/settingsStore');
  return structuredClone(defaultSettings);
}
/** Hash the entire configuration privately so even logo-only UI changes invalidate writes. */
export async function getRoasterLogoInfo(
  config: RoasterConfig | undefined,
  name: string
): Promise<Args> {
  let mimeType: string | null = null;
  let sizeBytes: number | null = null;
  let width: number | null = null;
  let height: number | null = null;
  if (config?.logoData) {
    try {
      const binary = validateMcpBeanImageDataUrl(config.logoData);
      mimeType = binary.mimeType;
      sizeBytes = binary.bytes.length;
      width = binary.width;
      height = binary.height;
    } catch {
      /* Legacy sources remain supported by the app; do not expose them. */
    }
  }
  const imageVersion = await recordVersion({
    roasterName: name,
    config: config ?? null,
  });
  return {
    roasterName: name,
    hasLogo: Boolean(config?.logoData),
    mimeType,
    sizeBytes,
    width,
    height,
    imageVersion,
    version: imageVersion,
  };
}
function checkArgs(name: string, args: Args) {
  const definition = roasterLogoDefinitions.find(item => item.name === name);
  if (!definition)
    throw new McpToolError('UNKNOWN_TOOL', 'Unknown roaster logo tool');
  validate(args, definition.schema);
}
export async function readRoasterLogoTool(
  tx: SqliteExecutor,
  name: string,
  args: Args
): Promise<Args> {
  checkArgs(name, args);
  const roaster = checkedName(args);
  const settings = await settingsAt(tx);
  const config = settings.roasterConfigs?.find(
    item => item.roasterName === roaster
  );
  const info = await getRoasterLogoInfo(config, roaster);
  if (name === 'get_roaster_logo') {
    if (args.includeImage !== true) return info;
    if (!config?.logoData)
      return { ...info, image: null, imageStatus: 'absent' };
    try {
      const binary = validateMcpBeanImageDataUrl(config.logoData);
      return {
        ...info,
        imageStatus: 'available',
        image: {
          dataUrl: config.logoData,
          mimeType: binary.mimeType,
          sizeBytes: binary.bytes.length,
          width: binary.width,
          height: binary.height,
        },
      };
    } catch {
      // Bounded, non-rendered legacy raster bytes remain recoverable. Never fetch URLs.
      try {
        if (
          config.logoData.length > MCP_BEAN_IMAGE_MAX_DATA_URL_LENGTH ||
          !/^data:image\/(?:gif|heic|heif|avif);base64,/.test(config.logoData)
        )
          throw new Error('Unsupported source');
        const binary = decodeImageDataUrl(config.logoData);
        if (
          !binary.bytes.length ||
          binary.bytes.length > MCP_BEAN_IMAGE_MAX_BYTES
        )
          throw new Error('Oversized source');
        return {
          ...info,
          imageStatus: 'opaque',
          image: {
            imageId: `roaster-logo:${roaster}`,
            mimeType: 'application/octet-stream',
            sourceMimeType: binary.mimeType,
            sizeBytes: binary.bytes.length,
            blob: config.logoData.slice(config.logoData.indexOf(',') + 1),
          },
        };
      } catch {
        return { ...info, image: null, imageStatus: 'unsupported_source' };
      }
    }
  }
  if (name !== 'preview_delete_roaster_logo')
    throw new McpToolError('UNKNOWN_TOOL', 'Unknown roaster logo read');
  if (!config?.logoData)
    throw new McpToolError('NOT_FOUND', 'Roaster logo not found');
  for (const [token, preview] of previews)
    if (
      preview.expires < Date.now() ||
      preview.generation !== localHistoryGeneration
    )
      previews.delete(token);
  if (previews.size >= 500) previews.delete(previews.keys().next().value!);
  const confirmationToken = await recordVersion({
    nonce: nanoid(),
    roaster,
    version: info.version,
  });
  previews.set(confirmationToken, {
    name: roaster,
    version: String(info.version),
    expires: Date.now() + 300000,
    generation: localHistoryGeneration,
  });
  return {
    ...info,
    confirmationToken,
    expiresInSeconds: 300,
    impact: { deletesOnlyLogo: true, tasteWindowsPreserved: true },
  };
}
/** Caller wraps in the standard idempotent MCP mutation transaction. No files or stores are touched. */
export async function mutateRoasterLogoTool(
  tx: SqliteExecutor,
  name: string,
  args: Args,
  dependencies: Pick<McpBeanImageDependencies, 'process'> = {}
): Promise<MutationWork<Args>> {
  checkArgs(name, args);
  const roaster = checkedName(args);
  const settings = await settingsAt(tx);
  const configs = settings.roasterConfigs ?? [];
  const old = configs.find(item => item.roasterName === roaster);
  const before = await getRoasterLogoInfo(old, roaster);
  if (args.expectedVersion !== before.version)
    throw new McpToolError(
      'CONFLICT',
      'Roaster configuration changed; read its logo metadata again.'
    );
  let logoData: string | undefined;
  if (name === 'delete_roaster_logo') {
    const preview = previews.get(String(args.confirmationToken));
    if (
      !preview ||
      preview.name !== roaster ||
      preview.version !== before.version ||
      preview.expires < Date.now() ||
      preview.generation !== localHistoryGeneration
    )
      throw new McpToolError(
        'CONFIRMATION_REQUIRED',
        'Get a fresh matching logo deletion preview.'
      );
    if (!old?.logoData)
      throw new McpToolError('NOT_FOUND', 'Roaster logo not found');
  } else if (name === 'set_roaster_logo') {
    const source = validateMcpBeanImageDataUrl(args.image);
    if (source.bytes.length > MCP_ROASTER_LOGO_MAX_BYTES)
      invalid('Roaster logo source must not exceed 5 MiB');
    logoData = await compressMcpImageDataUrl(
      String(args.image),
      ROASTER_LOGO_COMPRESSION_OPTIONS,
      dependencies.process
    );
    const compressed = validateMcpBeanImageDataUrl(logoData);
    if (
      Math.max(compressed.width, compressed.height) >
      ROASTER_LOGO_COMPRESSION_OPTIONS.maxWidthOrHeight
    )
      invalid('Roaster logo compression exceeded 512px');
    // Original-app byte target is soft (notably PNG); preserve its canonical output.
    // The shared validator still enforces the bounded 8 MiB raster ceiling.
  } else
    throw new McpToolError('UNKNOWN_TOOL', 'Unknown roaster logo mutation');
  const updated: RoasterConfig = {
    ...old,
    roasterName: roaster,
    logoData,
    updatedAt: Date.now(),
  };
  await saveAppSettings(tx, {
    ...settings,
    roasterConfigs: old
      ? configs.map(item => (item === old ? updated : item))
      : [...configs, updated],
  });
  const after = await getRoasterLogoInfo(updated, roaster);
  return {
    result: after,
    changes: [{ entity: 'settings', id: 'main', before, after }],
    summary:
      name === 'set_roaster_logo'
        ? 'Updated roaster logo'
        : 'Removed roaster logo',
  };
}
