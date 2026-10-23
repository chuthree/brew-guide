import type { CustomEquipment } from '@/lib/core/config';
import { invalid } from './validation';

export const MCP_SVG_MAX_BYTES = 256 * 1024;
export const MCP_SVG_TOTAL_BYTES = 2 * 1024 * 1024;
// The app animates arrays of static frames. Executable SVG/SMIL is not needed.
// Match DrawingCanvas output: editable monochrome polylines, not arbitrary SVG art.
const elements = new Set(['svg', 'path']);
const attributes = new Set(
  'xmlns width height viewBox class d fill stroke stroke-width stroke-linecap stroke-linejoin'.split(
    ' '
  )
);
const coordinate = String.raw`[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?`;
const point = `${coordinate}[\\s,]+${coordinate}`;
const canvasPath = new RegExp(
  `^\\s*M\\s*${point}(?:[\\s,]*L\\s*${point})*(?:[\\s,]*Z)?\\s*$`
);
function decoded(value: string): string {
  return value.replace(/&([^;]*);/g, (_, entity: string) => {
    const literals: Record<string, string> = {
      amp: '&',
      lt: '<',
      gt: '>',
      quot: '"',
      apos: "'",
    };
    if (Object.hasOwn(literals, entity)) return literals[entity];
    if (!/^#(?:[0-9]+|x[0-9a-f]+)$/i.test(entity))
      invalid('SVG entities are not supported.');
    const number =
      entity[1].toLowerCase() === 'x'
        ? parseInt(entity.slice(2), 16)
        : Number(entity.slice(1));
    if (
      !Number.isInteger(number) ||
      number < 32 ||
      number > 0x10ffff ||
      (number >= 0xd800 && number <= 0xdfff)
    )
      invalid('Invalid SVG character.');
    return String.fromCodePoint(number);
  });
}
/** Editable DrawingCanvas SVG subset, preserving accepted bytes.
 * New assets use monochrome M/L paths. Imported
 * existing assets are not revalidated/replaced during unrelated catalog edits.
 */
export function validateInlineSvg(svg: string): number {
  const bytes = new TextEncoder().encode(svg).length;
  if (bytes > MCP_SVG_MAX_BYTES) invalid('SVG exceeds 256 KiB.');
  if (!svg.trim()) return bytes; // App uses empty strings for blank frames/cleared drawings.
  if (
    /[\u0000-\u0008\u000b\u000c\u000e-\u001f]|<!|<\?|&(?!amp;|lt;|gt;|quot;|apos;|#[0-9]+;|#x[0-9a-f]+;)/i.test(
      svg
    )
  )
    invalid(
      'SVG declarations, entities or invalid characters are not supported.'
    );
  const stack: string[] = [];
  let cursor = 0,
    count = 0,
    roots = 0;
  const tags = /<\/?[A-Za-z][^<>]*>/g;
  for (const match of svg.matchAll(tags)) {
    const between = svg.slice(cursor, match.index);
    if (
      between.includes('<') ||
      between.includes('>') ||
      (!stack.length && between.trim())
    )
      invalid('Malformed SVG markup.');
    if (between.trim()) invalid('Canvas SVG cannot contain text.');
    cursor = match.index! + match[0].length;
    const token = match[0];
    const parsed = /^<(\/)?([A-Za-z][A-Za-z0-9]*)([\s\S]*?)(\/?)>$/.exec(token);
    if (!parsed) invalid('Malformed SVG element.');
    const [, closing, tag, rest, selfClosing] = parsed;
    if (!elements.has(tag))
      invalid(`Unsupported SVG element: ${tag}. Use static animation frames.`);
    if (closing) {
      if (rest.trim() || selfClosing || stack.pop() !== tag)
        invalid('Unbalanced SVG markup.');
      continue;
    }
    if (stack.length && (tag !== 'path' || stack[stack.length - 1] !== 'svg'))
      invalid('Canvas SVG supports only direct path children of svg.');
    if (!stack.length && (++roots !== 1 || tag !== 'svg'))
      invalid('SVG must have one svg root.');
    if (++count > 4096 || stack.length >= 64)
      invalid('SVG complexity limit exceeded.');
    let offset = 0;
    const seen = new Set<string>();
    const attrs = /\s+([A-Za-z][A-Za-z0-9:.-]*)\s*=\s*("[^"]*"|'[^']*')/g;
    for (const attr of rest.matchAll(attrs)) {
      if (rest.slice(offset, attr.index).trim())
        invalid('Malformed SVG attribute.');
      offset = attr.index! + attr[0].length;
      const name = attr[1];
      if (!attributes.has(name) || seen.has(name))
        invalid(`Unsupported or repeated SVG attribute: ${name}.`);
      seen.add(name);
      const value = decoded(attr[2].slice(1, -1));
      if (value.includes('<')) invalid('Invalid SVG attribute value.');
      if (
        name === 'class' &&
        value
          .split(/\s+/)
          .some(name => !['custom-cup-shape', 'outline-only'].includes(name))
      )
        invalid('Canvas SVG only supports the app drawing classes.');
      if (
        name === 'd' &&
        (tag !== 'path' ||
          !canvasPath.test(value) ||
          !(value.match(new RegExp(coordinate, 'g')) || []).every(number =>
            Number.isFinite(Number(number))
          ))
      )
        invalid(
          'Canvas paths must use one M followed by L commands, optionally Z. Approximate curves with separate polylines.'
        );
      if (name === 'fill' && value !== 'none')
        invalid('Canvas SVG must be outline-only: fill="none".');
      if (name === 'stroke' && value !== 'var(--custom-shape-color)')
        invalid(
          'Canvas SVG stroke must be var(--custom-shape-color); do not use fixed colors.'
        );
      if (
        name === 'stroke-width' &&
        (!Number.isFinite(Number(value)) || Number(value) <= 0)
      )
        invalid('Canvas stroke-width must be a positive number.');
      if (name === 'viewBox') {
        const bounds = value
          .trim()
          .split(/[\s,]+/)
          .map(Number);
        if (
          tag !== 'svg' ||
          bounds.length !== 4 ||
          !bounds.every(Number.isFinite) ||
          bounds[0] !== 0 ||
          bounds[1] !== 0 ||
          bounds[2] <= 0 ||
          bounds[3] <= 0
        )
          invalid(
            'Canvas viewBox must be 0 0 width height with positive dimensions.'
          );
      }
      if (
        name === 'xmlns' &&
        (tag !== 'svg' || value !== 'http://www.w3.org/2000/svg')
      )
        invalid('Unsupported SVG namespace.');
    }
    if (rest.slice(offset).trim()) invalid('Malformed SVG attributes.');
    if (tag === 'svg' && !seen.has('viewBox'))
      invalid('Canvas SVG requires a viewBox matching its drawing dimensions.');
    if (
      tag === 'path' &&
      !['d', 'stroke', 'stroke-width', 'fill'].every(name => seen.has(name))
    )
      invalid(
        'Each canvas path requires d, stroke, stroke-width and fill; do not rely on inherited styles.'
      );
    if (!selfClosing) stack.push(tag);
  }
  if (stack.length || roots !== 1 || svg.slice(cursor).trim())
    invalid('Malformed SVG document.');
  return bytes;
}

export function normalizeEquipmentSvgFields(
  fields: Partial<CustomEquipment>
): Partial<CustomEquipment> {
  const result = { ...fields };
  let bytes = 0;
  for (const key of [
    'customShapeSvg',
    'customValveSvg',
    'customValveOpenSvg',
  ] as const) {
    if (fields[key] !== undefined) bytes += validateInlineSvg(fields[key]!);
  }
  if (fields.customPourAnimations !== undefined) {
    const ids = new Set<string>();
    result.customPourAnimations = fields.customPourAnimations.map(animation => {
      if (animation.isSystemDefault)
        invalid(
          'System pour types are inherited from animationType, not stored as custom animations.'
        );
      if (
        [
          'center',
          'circle',
          'ice',
          'bypass',
          'wait',
          'other',
          'extraction',
          'beverage',
        ].includes(animation.id)
      )
        invalid('Custom animation IDs must not shadow system pour types.');
      if (ids.has(animation.id)) invalid('Animation IDs must be unique.');
      ids.add(animation.id);
      bytes += validateInlineSvg(animation.customAnimationSvg);
      const frameIds = new Set<string>();
      for (const frame of animation.frames || []) {
        if (frameIds.has(frame.id))
          invalid('Frame IDs must be unique within an animation.');
        frameIds.add(frame.id);
        bytes += validateInlineSvg(frame.svgData);
      }
      // Same canonical compatibility fields as CustomEquipmentForm.save.
      return animation.frames?.length
        ? {
            ...animation,
            customAnimationSvg: animation.frames[0].svgData,
            previewFrames: animation.frames.length,
          }
        : { ...animation };
    });
  }
  if (bytes > MCP_SVG_TOTAL_BYTES) invalid('Combined SVG assets exceed 2 MiB.');
  return result;
}
