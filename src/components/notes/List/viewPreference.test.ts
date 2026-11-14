import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import {
  getNotesViewPreference,
  saveNotesViewPreference,
} from './viewPreference';

beforeEach(() => {
  const values = new Map<string, string>();
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  };
  vi.stubGlobal('window', { localStorage: storage });
  vi.stubGlobal('localStorage', storage);
});
afterEach(() => vi.unstubAllGlobals());

it.each(['normal', 'date'] as const)(
  'restores %s image flow after remount and remembers it when leaving gallery',
  imageFlowType => {
    saveNotesViewPreference({ viewMode: 'gallery', imageFlowType });
    expect(getNotesViewPreference()).toEqual({
      viewMode: 'gallery',
      imageFlowType,
    });
    saveNotesViewPreference({ viewMode: 'table', imageFlowType });
    expect(getNotesViewPreference()).toEqual({
      viewMode: 'table',
      imageFlowType,
    });
    saveNotesViewPreference({ viewMode: 'gallery', imageFlowType });
    expect(getNotesViewPreference()).toEqual({
      viewMode: 'gallery',
      imageFlowType,
    });
  }
);

it.each(['normal', 'date'] as const)(
  'restores legacy %s image flow and ignores legacy flags after saving',
  imageFlowType => {
    localStorage.setItem('notes-view-mode', 'gallery');
    localStorage.setItem('notes-last-image-flow-type', imageFlowType);
    localStorage.setItem(
      `notes-is-${imageFlowType === 'date' ? 'date-' : ''}image-flow-mode`,
      'true'
    );
    expect(getNotesViewPreference()).toEqual({
      viewMode: 'gallery',
      imageFlowType,
    });
    saveNotesViewPreference({ viewMode: 'list', imageFlowType });
    expect(getNotesViewPreference()).toEqual({
      viewMode: 'list',
      imageFlowType,
    });
  }
);

it('uses defaults for invalid saved preferences and unavailable storage', () => {
  localStorage.setItem(
    'brew-guide:brewing-notes:viewPreference',
    '{"viewMode":"invalid","imageFlowType":"invalid"}'
  );
  expect(getNotesViewPreference()).toEqual({
    viewMode: 'list',
    imageFlowType: 'normal',
  });
  vi.stubGlobal('localStorage', {
    getItem: () => {
      throw new Error('denied');
    },
    setItem: () => {
      throw new Error('denied');
    },
  });
  expect(getNotesViewPreference()).toEqual({
    viewMode: 'list',
    imageFlowType: 'normal',
  });
});
