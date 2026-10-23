import type { BrewingNote, MethodParams } from '@/lib/core/config';
import { invalid } from './validation';

const positive = (value: unknown): number | undefined => {
  const parsed =
    typeof value === 'number' ? value : Number.parseFloat(String(value));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
};
const rounded = (value: number): number => Math.round(value * 1000) / 1000;
const ratioValue = (value: string | undefined): number | undefined => {
  const parts = value?.split(':');
  if (parts?.length !== 2) return undefined;
  const coffee = positive(parts[0]);
  const water = positive(parts[1]);
  return coffee && water ? water / coffee : undefined;
};

/** Apply only on an explicit request to use a recipe; never refresh history implicitly. */
export function applyNoteMethodPreset(
  note: BrewingNote,
  preset: MethodParams,
  fields: Record<string, unknown>,
  isEspresso: boolean
): void {
  const params = { ...note.params };
  for (const key of ['coffee', 'water', 'ratio', 'grindSize', 'temp'] as const) {
    const field = {
      coffee: 'coffeeGrams',
      water: 'waterGrams',
      ratio: 'ratio',
      grindSize: 'grindSize',
      temp: 'temperatureCelsius',
    }[key];
    // Espresso recipes historically store yield in water; notes use liquidWeight.
    if (isEspresso && key === 'water') continue;
    if (fields[field] === undefined && !params[key]?.trim())
      params[key] = preset[key];
  }
  if (
    fields.extractionTimeSeconds === undefined &&
    params.extractionTime === undefined
  )
    params.extractionTime = preset.extractionTime;
  if (fields.liquidWeightGrams === undefined && !params.liquidWeight)
    params.liquidWeight = preset.liquidWeight;

  // Measured water wins; otherwise a changed dose follows the selected ratio.
  const coffee = positive(params.coffee);
  const liquidKey = isEspresso ? 'liquidWeight' : 'water';
  const liquidField = isEspresso ? 'liquidWeightGrams' : 'waterGrams';
  const hadWater = Boolean(note.params?.[liquidKey]?.trim());
  const ratio = ratioValue(params.ratio);
  if (isEspresso && fields.liquidWeightGrams === undefined && !params.liquidWeight)
    params.liquidWeight = preset.liquidWeight || preset.water;
  if (
    coffee &&
    ratio &&
    !hadWater &&
    fields[liquidField] === undefined &&
    (coffee !== positive(preset.coffee) || fields.ratio !== undefined)
  )
    params[liquidKey] = `${Math.round(coffee * ratio)}g`;
  const water = positive(params[liquidKey]);
  if (coffee && water) {
    if (
      fields.ratio !== undefined &&
      ratio &&
      Math.abs(water - coffee * ratio) > 1
    )
      invalid(
        `coffeeGrams, ${liquidField} and ratio conflict. Supply consistent recipe changes.`
      );
    params.ratio = `1:${rounded(water / coffee)}`;
  }
  note.params = params;

  if (fields.stages !== undefined || note.stages?.length) return;
  const stageWaterTotal = preset.stages.reduce((total, stage) => {
    if (isEspresso && stage.pourType !== 'extraction') return total;
    return total + (positive(stage.water) ?? 0);
  }, 0);
  const presetWater =
    positive(stageWaterTotal) ??
    positive(isEspresso ? preset.liquidWeight || preset.water : preset.water);
  const factor = water && presetWater ? water / presetWater : 1;
  let cumulative = 0;
  let scaled = 0;
  note.stages = preset.stages.map(stage => {
    if (isEspresso && stage.pourType !== 'extraction') return { ...stage };
    if (!stage.water?.trim()) return { ...stage };
    const stageWater = Number.parseFloat(stage.water);
    if (!Number.isFinite(stageWater) || stageWater < 0) return { ...stage };
    cumulative += stageWater;
    const next = rounded(cumulative * factor);
    const result = { ...stage, water: `${rounded(next - scaled)}g` };
    scaled = next;
    return result;
  });
}
