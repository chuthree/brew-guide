import type { GrinderQuickAdjust } from '@/lib/data/models';

const ZERO = BigInt(0);
const ONE = BigInt(1);
const MAJOR_INTERVAL = BigInt(5);

function parseScale(text?: string) {
  if (typeof text !== 'string') return null;
  const value = text.trim();
  if (value.length > 300 || !/^\d+(?:\.\d+)*$/.test(value)) return null;

  const [first, ...rest] = value.split('.');
  return {
    ticks: BigInt(first + rest.join('')),
    leadingWidth: first.startsWith('0') ? first.length : 1,
    widths: rest.map(part => part.length),
  };
}

type ParsedScale = NonNullable<ReturnType<typeof parseScale>>;

function readMatchingTicks(scale: ParsedScale, text: string) {
  const parsed = parseScale(text);
  if (
    !parsed ||
    parsed.widths.length !== scale.widths.length ||
    !parsed.widths.every((width, index) => width === scale.widths[index])
  ) {
    return null;
  }
  return parsed.ticks;
}

function formatTicks(scale: ParsedScale, ticks: bigint) {
  const width = scale.widths.reduce((sum, part) => sum + part, 0);
  const digits = String(ticks).padStart(scale.leadingWidth + width, '0');
  let end = digits.length - width;
  const first = digits.slice(0, end);
  const rest = scale.widths.map(part => {
    const start = end;
    end += part;
    return digits.slice(start, end);
  });
  return [first, ...rest].join('.');
}

function readRange(format: ParsedScale, settings: GrinderQuickAdjust) {
  const step = settings.step ? readMatchingTicks(format, settings.step) : ONE;
  const min = settings.min ? readMatchingTicks(format, settings.min) : ZERO;
  const max = settings.max ? readMatchingTicks(format, settings.max) : null;
  if (
    step === null ||
    step < ONE ||
    min === null ||
    (settings.max && (max === null || max < min))
  ) {
    return null;
  }
  return { step, min, max };
}

function makeScale(
  base: ParsedScale,
  range: NonNullable<ReturnType<typeof readRange>>
) {
  const { step, min, max } = range;
  return {
    base,
    step,
    minOffset: -Number((base.ticks - min) / step),
    maxOffset: max === null ? Infinity : Number((max - base.ticks) / step),
    majorOffset: Number(((base.ticks - min) / step) % MAJOR_INTERVAL),
  };
}

type GrinderScale = ReturnType<typeof makeScale>;

export function getConfiguredGrinderScale(settings?: GrinderQuickAdjust) {
  // Earlier settings encoded the format in the range or the step.
  const format = parseScale(
    settings?.format ?? settings?.min ?? settings?.max ?? settings?.step
  );
  if (!format || !settings) return null;
  const range = readRange(format, settings);
  return range ? { ...range, format } : null;
}

type ConfiguredScale = NonNullable<
  ReturnType<typeof getConfiguredGrinderScale>
>;

export function normalizeScaleInput(
  input: string,
  configured: ConfiguredScale | null
) {
  const value = input.trim();
  if (!configured || !value) return value;

  const match = /^(-?)(\d+(?:\.\d+)*)$/.exec(value);
  if (!match || value.length > 300) return null;
  const [, sign, unsigned] = match;
  const [first, ...parts] = unsigned.split('.');
  const { format, min, max } = configured;
  if (
    parts.length > format.widths.length ||
    parts.some((part, index) => part.length > format.widths[index])
  ) {
    return null;
  }

  const digits = format.widths.map((width, index) =>
    (parts[index] ?? '').padEnd(width, '0')
  );
  const ticks = BigInt(sign + first + digits.join(''));
  const clamped = ticks < min ? min : max !== null && ticks > max ? max : ticks;
  const normalized = formatTicks(format, clamped);
  return normalized.length <= 300 ? normalized : null;
}

export function getGrinderScale(value?: string, settings?: GrinderQuickAdjust) {
  const configured = getConfiguredGrinderScale(settings);
  const base = parseScale(
    normalizeScaleInput(value ?? '', configured) ?? undefined
  );
  if (!base) return null;
  return makeScale(
    configured ? { ...configured.format, ticks: base.ticks } : base,
    configured ?? { step: ONE, min: ZERO, max: null }
  );
}

export function isMajorScaleMark(scale: GrinderScale, offset: number) {
  return (offset + scale.majorOffset) % Number(MAJOR_INTERVAL) === 0;
}

export function getScaleAt(scale: GrinderScale, offset: number) {
  if (offset < scale.minOffset || offset > scale.maxOffset) return null;
  return formatTicks(
    scale.base,
    scale.base.ticks + BigInt(offset) * scale.step
  );
}

export function getNextScaleExample(scale: GrinderScale) {
  return formatTicks(scale.base, scale.base.ticks + scale.step);
}

export function configureGrinderScale(
  value: string,
  next: string,
  min: string,
  max: string
) {
  const base = parseScale(value);
  if (!base) return null;

  const nextTicks = next ? readMatchingTicks(base, next) : base.ticks + ONE;
  if (nextTicks === null || nextTicks <= base.ticks) return null;

  const delta = nextTicks - base.ticks;
  const settings: GrinderQuickAdjust = {
    format: formatTicks(base, ZERO),
    ...(delta !== ONE && { step: formatTicks(base, delta) }),
    ...(min && { min }),
    ...(max && { max }),
  };
  const range = readRange(base, settings);
  if (
    !range ||
    base.ticks < range.min ||
    (range.max !== null && base.ticks > range.max)
  )
    return null;
  return { scale: makeScale(base, range), settings };
}
