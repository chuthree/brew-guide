import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { BrewingNoteData } from '@/types/app';

const fixture = vi.hoisted(() => ({
  leases: 0,
  save: undefined as undefined | ((note: BrewingNoteData) => Promise<void>),
}));
vi.mock('@/lib/app/runtime', () => ({
  detectAppRuntime: () => ({
    runtime: 'capacitor',
    capacitorPlatform: 'android',
    capacitorBundled: true,
  }),
}));
vi.mock('@/lib/data/sqlite/providerSqliteDriver', () => ({
  withAndroidDatabaseMutation: async (work: () => Promise<unknown>) => {
    fixture.leases++;
    return work();
  },
}));
vi.mock('./BrewingNoteForm', () => ({
  default: (props: { onSave: (note: BrewingNoteData) => Promise<void> }) => {
    fixture.save = props.onSave;
    return null;
  },
}));
vi.mock('@/components/common/ui/AdaptiveModal', () => ({
  default: ({
    children,
  }: {
    children: (layout: { isMediumScreen: boolean }) => React.ReactNode;
  }) => children({ isMediumScreen: false }),
}));

import { withDataMutation } from '@/lib/data/mutationCoordinator';
import {
  callStoreActionInMutation,
  coordinateStoreActions,
} from '@/lib/data/storeMutationBoundary';
import BrewingNoteEditModal from './BrewingNoteEditModal';
import { useCoordinatedAction } from '@/lib/hooks/useCoordinatedAction';

const close = () => {};

describe('note form modal callback ownership', () => {
  it('preserves registered raw identity through the actual modal onSave prop chain', async () => {
    const saved: string[] = [];
    const note = {
      id: 'note',
      timestamp: 1,
      rating: 4,
      taste: {},
      notes: 'User prose',
    } as BrewingNoteData;
    const store = coordinateStoreActions(
      {
        addNote: async (value: BrewingNoteData) => {
          saved.push(value.id!);
        },
      },
      ['addNote']
    );
    function Page() {
      const save = useCoordinatedAction(async (value: BrewingNoteData) => {
        await callStoreActionInMutation(store.addNote, value);
      });
      return (
        <BrewingNoteEditModal
          showModal
          initialData={note}
          onSave={save}
          onClose={close}
        />
      );
    }
    renderToStaticMarkup(<Page />);
    expect(fixture.save).toBeDefined();
    // Equivalent to the Form submission: its outer lease encompasses stock and
    // then the real modal callback, page callback, and Store action.
    await withDataMutation(async () => {
      await callStoreActionInMutation(fixture.save!, note);
    });
    expect(saved).toEqual(['note']);
    expect(fixture.leases).toBe(1);
    // The same modal callback remains safe when invoked as a standalone action.
    await fixture.save!(note);
    expect(saved).toEqual(['note', 'note']);
    expect(fixture.leases).toBe(2);
  });
});
