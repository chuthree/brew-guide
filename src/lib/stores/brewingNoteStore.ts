/**
 * 冲煮笔记 Store
 *
 * 架构：Store ↔ IndexedDB ↔ Supabase
 */

import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { BrewingNote } from '@/lib/core/config';
import { db } from '@/lib/core/db';
import { nanoid } from 'nanoid';
import {
  normalizeBrewingNote,
  normalizeStoredBrewingNotes,
} from '@/lib/notes/cleanup';
import { recordCrashCheckpoint } from '@/lib/app/crashDiagnostics';
import {
  mergeNoteWithStoredImages,
  persistBrewingNoteImagesFromNote,
} from '@/lib/notes/imageRepository';
import { stripBrewingNoteImages } from '@/lib/notes/imageRecords';

interface BrewingNoteStore {
  notes: BrewingNote[];
  isLoading: boolean;
  error: string | null;
  initialized: boolean;

  loadNotes: () => Promise<void>;
  addNote: (
    note: BrewingNote | Omit<BrewingNote, 'id'>
  ) => Promise<BrewingNote>;
  updateNote: (
    id: string,
    updates: Partial<BrewingNote>
  ) => Promise<BrewingNote | null>;
  deleteNote: (id: string) => Promise<boolean>;

  setNotes: (notes: BrewingNote[]) => void;
  upsertNote: (note: BrewingNote) => Promise<void>;
  removeNote: (id: string) => Promise<void>;

  getNoteById: (id: string) => BrewingNote | undefined;
  refreshNotes: () => Promise<void>;
}

export const useBrewingNoteStore = create<BrewingNoteStore>()(
  subscribeWithSelector((set, get) => ({
    notes: [],
    isLoading: false,
    error: null,
    initialized: false,

    loadNotes: async () => {
      if (get().isLoading) return;
      set({ isLoading: true, error: null });
      try {
        await normalizeStoredBrewingNotes();
        const notes = await db.brewingNotes.toArray();
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
      } catch {
        set({ error: '加载笔记失败', isLoading: false, initialized: true });
      }
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

      const noteForStore = await persistBrewingNoteImagesFromNote(newNote);
      await db.brewingNotes.put(noteForStore);
      set(state => ({ notes: [noteForStore, ...state.notes] }));

      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('brewingNoteDataChanged', {
            detail: { action: 'create', noteId: newNote.id, note: newNote },
          })
        );
      }
      return newNote;
    },

    updateNote: async (id, updates) => {
      const existingNote = get().notes.find(n => n.id === id);
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
        updatedAt: Date.now(), // 更新时间用于同步
      } as BrewingNote).note;

      // 移除变动记录字段
      if (shouldRemoveSource) delete (updatedNote as any).source;
      if (shouldRemoveQuickDecrement)
        delete (updatedNote as any).quickDecrementAmount;
      if (shouldRemoveChangeRecord) delete (updatedNote as any).changeRecord;

      const noteForStore = await persistBrewingNoteImagesFromNote(updatedNote);
      const eventNote = await mergeNoteWithStoredImages(noteForStore);
      await db.brewingNotes.put(noteForStore);
      set(state => ({
        notes: state.notes.map(n => (n.id === id ? noteForStore : n)),
      }));

      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('brewingNoteDataChanged', {
            detail: { action: 'update', noteId: id, note: eventNote },
          })
        );
      }
      return eventNote;
    },

    deleteNote: async id => {
      try {
        await db.transaction(
          'rw',
          db.brewingNotes,
          db.brewingNoteImages,
          db.brewingNoteImageThumbnails,
          async () => {
            await db.brewingNotes.delete(id);
            await db.brewingNoteImages.delete(id);
            await db.brewingNoteImageThumbnails.delete(id);
          }
        );
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
    },

    setNotes: notes =>
      set({
        notes: notes.map(note =>
          stripBrewingNoteImages(normalizeBrewingNote(note).note)
        ),
        initialized: true,
      }),

    upsertNote: async note => {
      const cleanNote = normalizeBrewingNote(note).note;
      const noteForStore = await persistBrewingNoteImagesFromNote(cleanNote);
      await db.brewingNotes.put(noteForStore);
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
      await db.transaction(
        'rw',
        db.brewingNotes,
        db.brewingNoteImages,
        db.brewingNoteImageThumbnails,
        async () => {
          await db.brewingNotes.delete(id);
          await db.brewingNoteImages.delete(id);
          await db.brewingNoteImageThumbnails.delete(id);
        }
      );
      set(state => ({ notes: state.notes.filter(n => n.id !== id) }));
    },

    getNoteById: id => get().notes.find(n => n.id === id),

    refreshNotes: async () => {
      set({ initialized: false });
      await get().loadNotes();
    },
  }))
);

export const getBrewingNoteStore = () => useBrewingNoteStore.getState();
