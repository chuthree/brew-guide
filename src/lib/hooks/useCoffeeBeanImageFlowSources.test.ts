import { describe, expect, it } from 'vitest';
import { createCoffeeBeanImageFlowSource } from './useCoffeeBeanImageFlowSources';
import type { CoffeeBeanImageRecord } from '@/lib/coffee-beans/imageRecords';

const bytesToDataUrl = (mimeType: string, bytes: number[]) =>
  `data:${mimeType};base64,${btoa(String.fromCharCode(...bytes))}`;

describe('createCoffeeBeanImageFlowSource', () => {
  it('uses stored original images with dimensions for stable image flow layout', () => {
    const image = bytesToDataUrl(
      'image/jpeg',
      [
        0xff, 0xd8, 0xff, 0xe0, 0x00, 0x04, 0x00, 0x00, 0xff, 0xc0, 0x00, 0x11,
        0x08, 0x03, 0x20, 0x04, 0xb0,
      ]
    );
    const record: CoffeeBeanImageRecord = {
      beanId: 'bean-1',
      image,
      imageThumbnail: 'thumbnail',
      updatedAt: 1,
    };

    expect(createCoffeeBeanImageFlowSource(record)).toEqual({
      beanId: 'bean-1',
      src: image,
      dimensions: {
        width: 1200,
        height: 800,
      },
    });
  });

  it('ignores records without readable dimensions', () => {
    const record: CoffeeBeanImageRecord = {
      beanId: 'bean-1',
      image: 'data:image/jpeg;base64,invalid',
      updatedAt: 1,
    };

    expect(createCoffeeBeanImageFlowSource(record)).toBeUndefined();
  });
});
