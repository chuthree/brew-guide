import {
  brewingNoteRepository,
  coffeeBeanRepository,
  customEquipmentRepository,
} from '@/lib/data/repositories';

export async function hasCoffeeBeans(): Promise<boolean> {
  return (await coffeeBeanRepository.count()) > 0;
}

export async function hasEnoughCoffeeBeans(minCount: number): Promise<boolean> {
  return (await coffeeBeanRepository.count()) >= minCount;
}

export async function hasBrewingNotes(): Promise<boolean> {
  return (await brewingNoteRepository.count()) > 0;
}

export async function hasSignificantUserData(
  minCount: number
): Promise<boolean> {
  const [notesCount, beansCount, equipmentsCount] = await Promise.all([
    brewingNoteRepository.count(),
    coffeeBeanRepository.count(),
    customEquipmentRepository.count(),
  ]);

  return notesCount + beansCount + equipmentsCount >= minCount;
}
