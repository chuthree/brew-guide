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

function hasMatchingFormat(scale: ParsedScale, parsed: ParsedScale) {
  return (
    parsed.widths.length === scale.widths.length &&
    parsed.widths.every((width, index) => width === scale.widths[index])
  );
}

function readMatchingTicks(scale: ParsedScale, text: string) {
  const parsed = parseScale(text);
  return parsed && hasMatchingFormat(scale, parsed) ? parsed.ticks : null;
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

export interface GrinderScaleForm {
  value: string;
  next: string;
  min: string;
  max: string;
}

export type GrinderScaleFormErrors = Partial<
  Record<keyof GrinderScaleForm, string>
>;

export function configureGrinderScale(
  form: GrinderScaleForm
):
  | { scale: GrinderScale; settings: GrinderQuickAdjust }
  | { errors: GrinderScaleFormErrors } {
  const start = parseScale(form.value);
  if (!start) {
    return {
      errors: {
        value: form.value.trim()
          ? '请输入数字刻度，如 24、5.2 或 1.0.2'
          : '请输入起始刻度',
      },
    };
  }

  const fields = (['next', 'min', 'max'] as const).map(key => ({
    key,
    text: form[key].trim(),
    parsed: parseScale(form[key]),
  }));
  const decimal = start.widths.length <= 1;
  const startPrecision = start.widths[0] ?? 0;
  const precision = decimal
    ? fields.reduce(
        (width, { parsed }) =>
          parsed?.widths.length === 1
            ? Math.max(width, parsed.widths[0])
            : width,
        startPrecision
      )
    : startPrecision;
  // A finer bound must not change the implicit step of the starting value.
  const defaultStep = BigInt(10) ** BigInt(precision - startPrecision);
  const base = decimal
    ? {
        ...start,
        widths: precision ? [precision] : [],
        ticks: start.ticks * defaultStep,
      }
    : start;
  const format = formatTicks(base, ZERO);
  const errors: GrinderScaleFormErrors = {};
  const ticks: Partial<Record<(typeof fields)[number]['key'], bigint>> = {};

  if (formatTicks(base, base.ticks).length > 300) {
    errors.value = '与小数位对齐后的刻度不能超过 300 个字符';
  }
  for (const { key, text, parsed } of fields) {
    if (!text) continue;
    if (decimal && parsed && parsed.widths.length <= 1) {
      ticks[key] =
        parsed.ticks *
        BigInt(10) ** BigInt(precision - (parsed.widths[0] ?? 0));
    } else if (parsed && hasMatchingFormat(base, parsed)) {
      ticks[key] = parsed.ticks;
    } else {
      errors[key] = decimal
        ? '请输入整数或小数'
        : `请输入与起始刻度相同的分段格式，如 ${format}`;
      continue;
    }
    if (formatTicks(base, ticks[key]).length > 300) {
      errors[key] = '与小数位对齐后的刻度不能超过 300 个字符';
    }
  }
  if (Object.keys(errors).length > 0) return { errors };

  const { next, min, max } = ticks;
  if (next !== undefined && next <= base.ticks) {
    errors.next = '下一格必须大于起始刻度';
  }
  if (min !== undefined && max !== undefined && min > max) {
    errors.max = '最大刻度不能小于最小刻度';
  } else if (min !== undefined && base.ticks < min) {
    errors.value = '起始刻度不能小于最小刻度';
  } else if (max !== undefined && base.ticks > max) {
    errors.value = '起始刻度不能大于最大刻度';
  }
  if (Object.keys(errors).length > 0) return { errors };

  const step = next === undefined ? defaultStep : next - base.ticks;
  const settings: GrinderQuickAdjust = {
    format,
    ...(step !== ONE && { step: formatTicks(base, step) }),
    ...(min !== undefined && { min: formatTicks(base, min) }),
    ...(max !== undefined && { max: formatTicks(base, max) }),
  };
  return {
    scale: makeScale(base, { step, min: min ?? ZERO, max: max ?? null }),
    settings,
  };
}
