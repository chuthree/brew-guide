import { describe, expect, it } from 'vitest';
import { setSvgDimensions } from './svgUtils';

describe('setSvgDimensions', () => {
  it('updates existing root dimensions without duplicating SVG attributes', () => {
    const svg =
      '<svg width="300" height="300" viewBox="0 0 300 300"><path d="M 1 2 L 3 4" /></svg>';

    const previewSvg = setSvgDimensions(svg, '100%', '100%');
    const svgRoot = previewSvg.match(/<svg\b[^>]*>/)?.[0] || '';

    expect(svgRoot.match(/\swidth\s*=/g)).toHaveLength(1);
    expect(svgRoot.match(/\sheight\s*=/g)).toHaveLength(1);
    expect(svgRoot).toContain('width="100%"');
    expect(svgRoot).toContain('height="100%"');
    expect(previewSvg).toContain('<path d="M 1 2 L 3 4" />');
  });
});
