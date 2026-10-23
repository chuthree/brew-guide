import type { McpCallResult } from './types';

const IMAGE_READ_TOOLS = new Set([
  'get_bean_image',
  'get_brew_note_image',
  'get_roaster_logo',
]);

/** Pixels are emitted only by explicit asset reads, never embedded in ordinary text/activity. */
export function resultFor(value: unknown, toolName?: string): McpCallResult {
  let structuredContent =
    typeof value === 'object' && value !== null && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : { result: value };
  const assets: McpCallResult['content'] = [];
  if (toolName && IMAGE_READ_TOOLS.has(toolName)) {
    const candidate = structuredContent.image;
    if (
      candidate &&
      typeof candidate === 'object' &&
      !Array.isArray(candidate)
    ) {
      const image = candidate as Record<string, unknown>;
      const { dataUrl, blob, ...metadata } = image;
      if (typeof dataUrl === 'string') {
        const separator = dataUrl.indexOf(',');
        const header = dataUrl.slice(0, separator);
        if (
          [
            'data:image/png;base64',
            'data:image/jpeg;base64',
            'data:image/webp;base64',
          ].includes(header)
        ) {
          assets.push({
            type: 'image',
            mimeType: header.slice(5, -7),
            data: dataUrl.slice(separator + 1),
          });
        }
      } else if (
        typeof blob === 'string' &&
        typeof image.imageId === 'string'
      ) {
        assets.push({
          type: 'resource',
          resource: {
            uri: `brewguide://image/${encodeURIComponent(image.imageId)}`,
            mimeType: 'application/octet-stream',
            blob,
          },
        });
      }
      structuredContent = { ...structuredContent, image: metadata };
    }
  }
  return {
    content: [
      { type: 'text', text: JSON.stringify(structuredContent) },
      ...assets,
    ],
    structuredContent,
  };
}
