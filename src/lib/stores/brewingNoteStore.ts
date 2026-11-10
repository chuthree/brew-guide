import {
  coordinateStoreActions,
  registerCoordinatedAction,
} from '@/lib/data/storeMutationBoundary';
/**
 * 冲煮笔记 Store
 *
 * 架构：Store ↔ IndexedDB ↔ Supabase
 */

import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { BrewingNote } from '@/lib/core/config';
import {
  brewingNoteImageRepository,
  brewingNotePersistence,
  brewingNoteRepository,
} from '@/lib/data/repositories';
import { nanoid } from 'nanoid';
import { normalizeBrewingNote } from '@/lib/notes/cleanup';
import { recordCrashCheckpoint } from '@/lib/app/crashDiagnostics';
import {
  clearExpectedCoreDataDeletion,
  markExpectedCoreDataDeletionIfEmpty,
} from '@/lib/app/dataIntegrity';
import { stripBrewingNoteImages } from '@/lib/notes/imageRecords';
import { withDataMutation } from '@/lib/data/mutationCoordinator';
import { getCoffeeBeanStore } from '@/lib/stores/coffeeBeanStore';
import type {
  BrewingNoteInventoryChanges,
  BrewingNoteSaveOptions,
} from '@/lib/notes/inventory';

function publishInventoryChanges(changes: BrewingNoteInventoryChanges) {
  if (!changes.beans.length) return;
  const store = getCoffeeBeanStore();
  const updatedIds = new Set(changes.beans.map(bean => bean.id));
  store.setBeans([
    ...store.beans.filter(bean => !updatedIds.has(bean.id)),
    ...changes.beans,
  ]);
  if (typeof window !== 'undefined') {
    for (const bean of changes.beans)
      window.dispatchEvent(
        new CustomEvent('coffeeBeanDataChanged', {
          detail: { action: 'update', beanId: bean.id, bean },
        })
      );
  }
}

interface BrewingNoteStore {
  notes: BrewingNote[];
  isLoading: boolean;
  error: string | null;
  initialized: boolean;

  loadNotes: () => Promise<void>;
  addNote: (
    note: BrewingNote | Omit<BrewingNote, 'id'>
  ) => Promise<BrewingNote>;
  saveNoteWithInventory: (
    note: BrewingNote,
    options?: BrewingNoteSaveOptions
  ) => Promise<BrewingNote>;
  updateNote: (
    id: string,
    updates: Partial<BrewingNote>
  ) => Promise<BrewingNote | null>;
  deleteNote: (id: string) => Promise<boolean>;

  setNotes: (notes: BrewingNote[], initialized?: boolean) => void;
  upsertNote: (note: BrewingNote) => Promise<void>;
  removeNote: (id: string) => Promise<void>;

  getNoteById: (id: string) => BrewingNote | undefined;
  refreshNotes: () => Promise<void>;
}

let noteRefreshVersion = 0;
let noteLoadPromise: Promise<void> | null = null;

export const useBrewingNoteStore = create<BrewingNoteStore>()(
  subscribeWithSelector((set, get) => {
    const updateNoteInMutation = async (
      id: string,
      updates: Partial<BrewingNote>,
      existingNote: BrewingNote | undefined
    ) => {
      if (!existingNote) return null;

      // 检测需要移除的变动记录字段（显式设为 undefined 表示要删除）
      const shouldRemoveSource =
        'source' in updates && updates.source === undefined;
      const shouldRemoveQuickDecrement =
        'quickDecrementAmount' in updates &&
        updates.quickDecrementAmount === undefined;
      const shouldRemoveChangeRecord =
        'changeRecord' in updates && updates.changeRecord === undefined;

      const updatedNote = normalizeBrewingNote({
        ...existingNote,
        ...updates,
        id,
        // 如果 updates 包含 timestamp，使用它（用户修改了记录时间）；否则保留原始创建时间
        timestamp:
          'timestamp' in updates && updates.timestamp !== undefined
            ? updates.timestamp
            : existingNote.timestamp,
        updatedAt: Math.max(
          Date.now(),
          (existingNote.updatedAt ?? existingNote.timestamp) + 1
        ), // 更新时间用于同步
      } as BrewingNote).note;

      // 移除变动记录字段
      if (shouldRemoveSource) delete (updatedNote as any).source;
      if (shouldRemoveQuickDecrement)
        delete (updatedNote as any).quickDecrementAmount;
      if (shouldRemoveChangeRecord) delete (updatedNote as any).changeRecord;

      const savedNote = await brewingNotePersistence.saveWithImages(
        updatedNote,
        { expectedRecord: existingNote }
      );
      const savedEventNote =
        await brewingNoteImageRepository.mergeNote(savedNote);
      set(state => ({
        notes: state.notes.map(n => (n.id === id ? savedNote : n)),
      }));

      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('brewingNoteDataChanged', {
            detail: { action: 'update', noteId: id, note: savedEventNote },
          })
        );
      }
      return savedEventNote;
    };
    const deleteNoteInMutation = async (
      id: string,
      expectedRecord: BrewingNote | undefined
    ) => {
      try {
        const note = await brewingNoteRepository.get(id);
        if (!note) return true;
        if (note?.source === 'roasting') {
          const { saveRoastingBatchInMutation } =
            await import('@/lib/managers/roastingBatchManager');
          await saveRoastingBatchInMutation({
            noteId: id,
            beanId: note.changeRecord?.roastingRecord?.roastedBeanId ?? '',
            now: Date.now(),
            expectedUpdatedAt:
              expectedRecord?.updatedAt ??
              expectedRecord?.timestamp ??
              note.updatedAt ??
              note.timestamp,
          });
          return true;
        }
        const changes = await brewingNotePersistence.deleteWithInventory(id, {
          expectedRecord,
        });
        publishInventoryChanges(changes);
        await markExpectedCoreDataDeletionIfEmpty();
        set(state => ({ notes: state.notes.filter(n => n.id !== id) }));

        if (typeof window !== 'undefined') {
          window.dispatchEvent(
            new CustomEvent('brewingNoteDataChanged', {
              detail: { action: 'delete', noteId: id },
            })
          );
        }
        return true;
      } catch {
        return false;
      }
    };
    return coordinateStoreActions<BrewingNoteStore>(
      {
        notes: [],
        isLoading: false,
        error: null,
        initialized: false,

        loadNotes: () => {
          if (noteLoadPromise) return noteLoadPromise;
          noteLoadPromise = Promise.resolve().then(async () => {
            set({ isLoading: true, error: null });
            try {
              while (true) {
                const previousNotes = get().notes;
                const refreshVersion = noteRefreshVersion;
                const notes = await brewingNoteRepository.list();
                // A write or explicit refresh can finish while this read is pending.
                // Read again rather than publishing an older snapshot over it.
                if (
                  previousNotes !== get().notes ||
                  refreshVersion !== noteRefreshVersion
                ) {
                  continue;
                }
                recordCrashCheckpoint('brewing-notes:loaded', {
                  noteCount: notes.length,
                });
                set({
                  notes: notes.map(note =>
                    stripBrewingNoteImages(normalizeBrewingNote(note).note)
                  ),
                  isLoading: false,
                  initialized: true,
                });
                return;
              }
            } catch (error) {
              set({
                error: '加载笔记失败',
                isLoading: false,
                initialized: false,
              });
              throw error;
            } finally {
              noteLoadPromise = null;
            }
          });
          return noteLoadPromise;
        },

        addNote: async noteData => {
          const inputNote = noteData as BrewingNote;
          const now = Date.now();
          const timestamp = inputNote.timestamp || now;
          const newNote = normalizeBrewingNote({
            ...noteData,
            id: inputNote.id || nanoid(),
            timestamp,
            updatedAt: inputNote.updatedAt || timestamp, // 创建时也设置 updatedAt，与 timestamp 相同
          } as BrewingNote).note;

          const noteForStore =
            await brewingNotePersistence.saveWithImages(newNote);
          await clearExpectedCoreDataDeletion();
          set(state => ({
            notes: [
              noteForStore,
              ...state.notes.filter(note => note.id !== noteForStore.id),
            ],
          }));

          if (typeof window !== 'undefined') {
            window.dispatchEvent(
              new CustomEvent('brewingNoteDataChanged', {
                detail: { action: 'create', noteId: newNote.id, note: newNote },
              })
            );
          }
          return newNote;
        },

        saveNoteWithInventory: async (note, options) => {
          const changes = await brewingNotePersistence.saveWithInventory(
            normalizeBrewingNote(note).note,
            options
          );
          const savedNote = changes.note!;
          const eventNote =
            await brewingNoteImageRepository.mergeNote(savedNote);
          publishInventoryChanges(changes);
          set(state => ({
            notes: [
              savedNote,
              ...state.notes.filter(current => current.id !== savedNote.id),
            ],
          }));
          await clearExpectedCoreDataDeletion();
          if (typeof window !== 'undefined' && !changes.unchanged) {
            window.dispatchEvent(
              new CustomEvent('brewingNoteDataChanged', {
                detail: {
                  action: changes.created ? 'create' : 'update',
                  noteId: savedNote.id,
                  note: eventNote,
                },
              })
            );
          }
          return eventNote;
        },

        updateNote: registerCoordinatedAction(
          (id: string, updates: Partial<BrewingNote>) => {
            const snapshot = get().notes.find(record => record.id === id);
            return withDataMutation(() =>
              updateNoteInMutation(id, updates, snapshot)
            );
          },
          (id: string, updates: Partial<BrewingNote>) =>
            updateNoteInMutation(
              id,
              updates,
              get().notes.find(record => record.id === id)
            )
        ),

        deleteNote: registerCoordinatedAction(
          (id: string) => {
            const snapshot = get().notes.find(record => record.id === id);
            return withDataMutation(() => deleteNoteInMutation(id, snapshot));
          },
          (id: string) =>
            deleteNoteInMutation(
              id,
              get().notes.find(record => record.id === id)
            )
        ),

        setNotes: (notes, initialized = true) =>
          set({
            notes: notes.map(note =>
              stripBrewingNoteImages(normalizeBrewingNote(note).note)
            ),
            initialized,
          }),

        upsertNote: async note => {
          const cleanNote = normalizeBrewingNote(note).note;
          const noteForStore =
            await brewingNotePersistence.saveWithImages(cleanNote);
          await clearExpectedCoreDataDeletion();
          set(state => {
            const exists = state.notes.some(n => n.id === noteForStore.id);
            return exists
              ? {
                  notes: state.notes.map(n =>
                    n.id === noteForStore.id ? noteForStore : n
                  ),
                }
              : { notes: [noteForStore, ...state.notes] };
          });
        },

        removeNote: async id => {
          await brewingNotePersistence.deleteWithImages(id);
          await markExpectedCoreDataDeletionIfEmpty();
          set(state => ({ notes: state.notes.filter(n => n.id !== id) }));
        },

        getNoteById: id => get().notes.find(n => n.id === id),

        refreshNotes: async () => {
          noteRefreshVersion += 1;
          set({ initialized: false });
          await get().loadNotes();
        },
      },
      ['addNote', 'saveNoteWithInventory', 'upsertNote', 'removeNote']
    );
  })
);

export const getBrewingNoteStore = () => useBrewingNoteStore.getState();
