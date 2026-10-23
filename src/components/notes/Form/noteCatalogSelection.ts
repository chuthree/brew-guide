import {
  callStoreActionInMutation,
  coordinateStoreActions,
} from '@/lib/data/storeMutationBoundary';
import type { BrewingNote } from '@/lib/core/config';
import { loadCustomEquipments } from '@/lib/stores/customEquipmentStore';
import { loadCustomMethods } from '@/lib/stores/customMethodStore';
import { useSettingsStore } from '@/lib/stores/settingsStore';
import {
  buildNoteReferenceCatalog,
  resolveNoteReferences,
} from '@/lib/notes/catalogReferences';

export type NoteSelection = Pick<
  BrewingNote,
  | 'equipment'
  | 'method'
  | 'equipmentId'
  | 'methodId'
  | 'equipmentName'
  | 'methodName'
>;

export const pickNoteSelection = (note: NoteSelection): NoteSelection => ({
  equipment: note.equipment,
  method: note.method,
  equipmentId: note.equipmentId,
  methodId: note.methodId,
  equipmentName: note.equipmentName,
  methodName: note.methodName,
});

async function resolveFormNoteSelectionRaw(
  input: NoteSelection,
  previous?: NoteSelection
): Promise<NoteSelection> {
  const [equipment, methods] = await Promise.all([
    callStoreActionInMutation(loadCustomEquipments),
    callStoreActionInMutation(loadCustomMethods),
  ]);
  const catalog = buildNoteReferenceCatalog(
    equipment,
    Object.entries(methods).map(([equipmentId, methods]) => ({
      equipmentId,
      methods,
    })),
    useSettingsStore.getState().settings.equipmentNameOverrides
  );
  return resolveNoteReferences(input, catalog, previous);
}

export const resolveFormNoteSelection = coordinateStoreActions(
  { resolve: resolveFormNoteSelectionRaw },
  ['resolve']
).resolve;
