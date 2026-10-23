import { describe, expect, it } from 'vitest';
import { linesToSvgPath } from '@/lib/utils/svgUtils';
import {
  normalizeEquipmentSvgFields,
  validateInlineSvg,
  MCP_SVG_MAX_BYTES,
} from './svgAssets';

describe('MCP inline SVG assets', () => {
  const svg = linesToSvgPath(
    [
      {
        points: [
          { x: 1.234, y: 2 },
          { x: 30, y: 40 },
        ],
        strokeWidth: 1.5,
        color: 'black',
      },
    ],
    200,
    150
  );
  it('preserves original canonical canvas bytes and normalizes animation compatibility metadata', () => {
    expect(validateInlineSvg(svg)).toBe(new TextEncoder().encode(svg).length);
    expect(
      normalizeEquipmentSvgFields({ customShapeSvg: svg }).customShapeSvg
    ).toBe(svg);
    const animations = normalizeEquipmentSvgFields({
      customPourAnimations: [
        {
          id: 'pour-1',
          name: '绕圈',
          customAnimationSvg: '',
          previewFrames: 99,
          frames: [
            { id: 'f1', svgData: svg },
            { id: 'f2', svgData: '' },
          ],
        },
      ],
    }).customPourAnimations!;
    expect(animations[0]).toMatchObject({
      customAnimationSvg: svg,
      previewFrames: 2,
    });
    expect(animations[0].frames?.[1].svgData).toBe('');
  });
  it('rejects non-editable gradients and text in newly supplied canvas assets', () => {
    expect(() =>
      validateInlineSvg(
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><defs><linearGradient id="g"><stop offset="0" stop-color="#fff"/></linearGradient></defs><path d="M0 0L1 1" fill="url(#g)"/><title>杯 &amp; 豆</title></svg>'
      )
    ).toThrow('Unsupported SVG element: defs');
  });
  it.each([
    '<svg><script>alert(1)</script></svg>',
    '<svg onload="x()"/>',
    '<svg><foreignObject/></svg>',
    '<svg><image href="https://example.com/a"/></svg>',
    '<svg><use href="https://example.com/a"/></svg>',
    '<svg><path fill="url(https://example.com/a)"/></svg>',
    '<svg><path fill="url(&#104;ttps://example.com/a)"/></svg>',
    '<svg><path style="fill:red"/></svg>',
    '<svg><animate attributeName="href"/></svg>',
    '<!DOCTYPE svg [<!ENTITY x SYSTEM "file:///etc/passwd">]><svg>&x;</svg>',
    '<?xml-stylesheet href="https://example.com"?><svg/>',
    '<svg><g></svg>',
    '<svg/><svg/>',
    '<svg xmlns="http://evil.test"/>',
    '<svg><path d="&unknown;"/></svg>',
    '<svg><path d="x" d="y"/></svg>',
    '<svg><path fill="u&#114;l(//example.com)"/></svg>',
  ])('rejects unsafe or malformed SVG %s', svg =>
    expect(() => validateInlineSvg(svg)).toThrow()
  );
  it('bounds the aggregate frame payload', () => {
    const frameSvg = `<svg viewBox="0 0 300 300">${' '.repeat(250 * 1024)}</svg>`;
    expect(() =>
      normalizeEquipmentSvgFields({
        customPourAnimations: [
          {
            id: 'p',
            name: 'P',
            customAnimationSvg: '',
            frames: Array.from({ length: 9 }, (_, index) => ({
              id: `frame-${index}`,
              svgData: frameSvg,
            })),
          },
        ],
      })
    ).toThrow('Combined SVG');
  });
  it('bounds size, depth, element count and duplicate frame identities', () => {
    expect(() =>
      validateInlineSvg(`<svg>${' '.repeat(MCP_SVG_MAX_BYTES)}</svg>`)
    ).toThrow();
    expect(() =>
      validateInlineSvg(`<svg>${'<g>'.repeat(70)}${'</g>'.repeat(70)}</svg>`)
    ).toThrow();
    expect(() =>
      validateInlineSvg(`<svg>${'<path/>'.repeat(4097)}</svg>`)
    ).toThrow();
    expect(() =>
      normalizeEquipmentSvgFields({
        customPourAnimations: [
          {
            id: 'p',
            name: 'P',
            customAnimationSvg: '',
            frames: [
              { id: 'f', svgData: '' },
              { id: 'f', svgData: '' },
            ],
          },
        ],
      })
    ).toThrow();
  });
});
