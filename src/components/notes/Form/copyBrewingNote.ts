import type { BrewingNote } from '@/lib/core/config';
import type { BrewingNoteData } from '@/types/app';
import { brewingNoteRepository } from '@/lib/data/repositories';
import { roastingInputs } from '@/lib/coffee-beans/roastingBatch';
import { showToast } from '@/components/common/feedback/LightToast';
import { nanoid } from 'nanoid';
import { useBrewingNoteStore } from '@/lib/stores/brewingNoteStore';

function createBrewingNoteCopyData(note: BrewingNote): BrewingNoteData {
  return structuredClone({
    id: '',
    timestamp: Date.now(),
    equipment: note.equipment,
    method: note.method,
    equipmentId: note.equipmentId,
    equipmentName: note.equipmentName,
    methodId: note.methodId,
    methodName: note.methodName,
    params: note.params,
    stages: note.stages,
    coffeeBeanInfo: note.coffeeBeanInfo || { name: '', roastLevel: '' },
    rating: note.rating,
    taste: note.taste,
    notes: note.notes,
    totalTime: note.totalTime,
    beanId: note.beanId,
    source: note.source,
    quickDecrementAmount: note.quickDecrementAmount,
    changeRecord: note.changeRecord,
  });
}

export async function copyBrewingNote(noteId: string): Promise<void> {
  try {
    const note = await brewingNoteRepository.get(noteId);
    if (!note) throw new Error('笔记已删除，无法复制');
    if (note.source === 'roasting') {
      const inputs = roastingInputs(note.changeRecord?.roastingRecord);
      if (!inputs.length) throw new Error('烘焙记录数据不完整，无法复制');
      window.dispatchEvent(
        new CustomEvent('openRoastingDrawer', {
          detail: {
            sourceIds: inputs.map(input => input.greenBeanId),
            initialNote: note,
          },
        })
      );
    } else if (
      note.source === 'quick-decrement' ||
      note.source === 'capacity-adjustment'
    ) {
      await useBrewingNoteStore.getState().saveNoteWithInventory({
        ...createBrewingNoteCopyData(note),
        id: nanoid(),
      });
      showToast({ type: 'success', title: '记录已复制' });
    } else {
      window.dispatchEvent(
        new CustomEvent('brewingNoteEditOpened', {
          detail: { data: createBrewingNoteCopyData(note) },
        })
      );
    }
  } catch (error) {
    showToast({
      type: 'error',
      title: error instanceof Error ? error.message : '复制笔记失败，请重试',
    });
  }
}
