/** Shared input-to-note conversion for native MCP and Web commands. No persistence. */
import { nanoid } from 'nanoid';
import type { BrewingNote } from '@/lib/core/config';
import { normalizeBrewingNote } from '@/lib/notes/cleanup';
import { parseCoffeeBeanAmount } from '@/lib/coffee-beans/amount';
import { stripBrewingNoteImages } from '@/lib/notes/imageRecords';
import { invalid } from './validation';

type Arguments = Record<string, unknown>;
const noteTextFields = ['equipment', 'method', 'notes'] as const;
const amount = parseCoffeeBeanAmount;
const gramText = (value: number): string =>
  String(Math.round(value * 1000) / 1000);
const timestampAfter = (previous = 0): number =>
  Math.max(Date.now(), previous + 1);

export function noteDose(note: BrewingNote): number {
  if (note.source === 'quick-decrement') {
    const quick = amount(note.quickDecrementAmount);
    if (quick !== null && quick > 0) return quick;
  }
  return amount(note.params?.coffee) ?? 0;
}

function hasBrewDetails(fields: Arguments): boolean {
  return (
    fields.applyMethodPreset === true ||
    (Array.isArray(fields.stages) && fields.stages.length > 0) ||
    ['extractionTimeSeconds', 'liquidWeightGrams'].some(
      key => fields[key] !== undefined && fields[key] !== null
    ) ||
    [
      'equipment',
      'method',
      'equipmentId',
      'methodId',
      'waterGrams',
      'temperatureCelsius',
      'totalTimeSeconds',
      'grindSize',
      'ratio',
      'rating',
    ].some(key => Boolean(fields[key])) ||
    Object.values(
      (fields.taste as Record<string, unknown> | undefined) ?? {}
    ).some(Boolean)
  );
}

export function buildNoteInput(
  fields: Arguments,
  previous?: BrewingNote
): BrewingNote {
  const now = Date.now();
  const note: BrewingNote = previous
    ? { ...stripBrewingNoteImages(previous), params: { ...previous.params } }
    : {
        id: nanoid(),
        timestamp: now,
        updatedAt: now,
        notes: '',
        rating: 0,
        taste: {},
        params: { coffee: '', water: '', temp: '', ratio: '', grindSize: '' },
      };
  for (const key of noteTextFields)
    if (fields[key] !== undefined) note[key] = (fields[key] as string).trim();
  if (fields.beanId !== undefined)
    note.beanId = (fields.beanId as string).trim() || undefined;
  if (fields.brewedAt !== undefined)
    note.timestamp = Date.parse(fields.brewedAt as string);
  if (fields.beanSnapshot !== undefined) {
    if (fields.beanSnapshot === null) delete note.coffeeBeanInfo;
    else
      note.coffeeBeanInfo = {
        ...(fields.beanSnapshot as NonNullable<BrewingNote['coffeeBeanInfo']>),
        roastLevel:
          (
            fields.beanSnapshot as Partial<
              NonNullable<BrewingNote['coffeeBeanInfo']>
            >
          ).roastLevel ?? '',
      };
  }
  if (fields.stages !== undefined)
    note.stages = fields.stages as BrewingNote['stages'];
  if (fields.rating !== undefined) note.rating = fields.rating as number;
  if (fields.taste !== undefined)
    note.taste = { ...note.taste, ...(fields.taste as Record<string, number>) };
  if (fields.totalTimeSeconds !== undefined)
    note.totalTime = fields.totalTimeSeconds as number;
  const params = note.params ?? {};
  if (fields.coffeeGrams !== undefined) {
    params.coffee = `${gramText(fields.coffeeGrams as number)}g`;
    if (note.source === 'quick-decrement') {
      note.quickDecrementAmount = amount(params.coffee) ?? 0;
      note.changeRecord = {
        ...note.changeRecord,
        quickDecrementAmount: amount(params.coffee) ?? 0,
      };
    }
  }
  if (fields.waterGrams !== undefined)
    params.water = `${gramText(fields.waterGrams as number)}g`;
  if (fields.extractionTimeSeconds !== undefined) {
    if (fields.extractionTimeSeconds === null) delete params.extractionTime;
    else params.extractionTime = fields.extractionTimeSeconds as number;
  }
  if (fields.liquidWeightGrams !== undefined) {
    if (fields.liquidWeightGrams === null) delete params.liquidWeight;
    else
      params.liquidWeight = `${gramText(fields.liquidWeightGrams as number)}g`;
  }
  if (fields.temperatureCelsius !== undefined)
    params.temp = `${gramText(fields.temperatureCelsius as number)}°C`;
  if (fields.grindSize !== undefined)
    params.grindSize = fields.grindSize as string;
  if (fields.ratio !== undefined) params.ratio = fields.ratio as string;
  note.params = params;
  const wantsQuick =
    fields.recordType === 'quick-decrement' ||
    (!previous &&
      fields.recordType !== 'brew' &&
      Boolean(note.beanId) &&
      noteDose(note) > 0 &&
      !hasBrewDetails(fields));
  if (wantsQuick) {
    if (!note.beanId || noteDose(note) <= 0)
      invalid(
        'A quick-decrement record requires a beanId and positive coffeeGrams'
      );
    if (hasBrewDetails(fields))
      invalid(
        'Quick-decrement records cannot contain brewing parameters or ratings. Use recordType brew.'
      );
    note.source = 'quick-decrement';
    note.quickDecrementAmount = amount(params.coffee) ?? 0;
    note.equipment = '';
    note.method = '';
    delete note.equipmentId;
    delete note.methodId;
    delete note.equipmentName;
    delete note.methodName;
    note.rating = 0;
    note.taste = {};
    note.totalTime = 0;
    note.params = {
      coffee: params.coffee,
      water: '',
      ratio: '',
      grindSize: '',
      temp: '',
    };
    delete note.changeRecord;
  } else if (
    fields.recordType === 'brew' ||
    (previous?.source === 'quick-decrement' &&
      (hasBrewDetails(fields) || !note.beanId))
  ) {
    delete note.source;
    delete note.quickDecrementAmount;
    delete note.changeRecord;
  }
  note.updatedAt = timestampAfter(previous?.updatedAt ?? previous?.timestamp);
  return normalizeBrewingNote(note).note;
}
