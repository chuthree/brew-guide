import { describe, expect, it } from 'vitest';
import {
  createCoffeeBeanImageFlowSource,
  MAX_COFFEE_BEAN_IMAGE_FLOW_SOURCE_CACHE_ENTRIES,
  trimCoffeeBeanImageFlowSourceCache,
  type CoffeeBeanImageFlowSource,
} from './useCoffeeBeanImageFlowSources';
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

  it('keeps the image-flow source cache within its hard limit', () => {
    const cache = new Map<string, CoffeeBeanImageFlowSource>();
    const protectedKeys = new Set<string>();

    for (
      let index = 0;
      index <= MAX_COFFEE_BEAN_IMAGE_FLOW_SOURCE_CACHE_ENTRIES;
      index++
    ) {
      const key = `front:${index}`;
      cache.set(key, {
        beanId: String(index),
        src: `data:image/jpeg;base64,${index}`,
        dimensions: { width: 1, height: 1 },
      });
      protectedKeys.add(key);
    }

    trimCoffeeBeanImageFlowSourceCache(cache, protectedKeys);

    expect(cache.size).toBe(MAX_COFFEE_BEAN_IMAGE_FLOW_SOURCE_CACHE_ENTRIES);
    expect(cache.has('front:0')).toBe(false);
  });
});
