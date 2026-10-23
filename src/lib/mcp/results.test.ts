import { describe, expect, it } from 'vitest';
import { resultFor } from './results';
describe('explicit MCP asset result transport', () => {
  it('emits standard image content without base64 in metadata or text', () => {
    const value = {
      image: {
        imageId: 'own',
        mimeType: 'image/png',
        dataUrl: 'data:image/png;base64,AQID',
        sizeBytes: 3,
      },
    };
    const result = resultFor(value, 'get_brew_note_image');
    expect(result.content[1]).toEqual({
      type: 'image',
      mimeType: 'image/png',
      data: 'AQID',
    });
    expect(JSON.stringify(result.structuredContent)).not.toContain('AQID');
    expect(JSON.stringify(result.content[0])).not.toContain('AQID');
    expect(value.image.dataUrl).toContain('AQID');
  });
  it('emits opaque legacy bytes as a non-executable resource with an escaped internal identifier', () => {
    const result = resultFor(
      { image: { imageId: 'id/#', blob: 'AQID', status: 'opaque' } },
      'get_bean_image'
    );
    expect(result.content[1]).toEqual({
      type: 'resource',
      resource: {
        uri: 'brewguide://image/id%2F%23',
        mimeType: 'application/octet-stream',
        blob: 'AQID',
      },
    });
    expect(JSON.stringify(result.structuredContent)).not.toContain('blob');
  });
  it('does not interpret arbitrary stored report/user data as executable image content', () => {
    expect(
      resultFor(
        { image: { dataUrl: 'data:image/png;base64,AQID' } },
        'get_historical_report'
      ).content
    ).toHaveLength(1);
    expect(
      resultFor(
        { image: { dataUrl: 'data:text/html;base64,AQID' } },
        'get_roaster_logo'
      ).content
    ).toHaveLength(1);
  });
});
