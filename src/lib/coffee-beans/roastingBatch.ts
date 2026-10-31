import type { BrewingNote } from '@/lib/core/config';
import type { CoffeeBean, RoastingInput } from '@/types/app';
import { parseCoffeeBeanAmount } from './amount';
import {
  formatCoffeeBeanDisplayName,
  normalizeFlavorList,
} from '@/lib/utils/coffeeBeanUtils';

export interface RoastingDraft {
  inputs: { greenBeanId: string; amount: number }[];
  name: string;
  roaster?: string;
  outputAmount: number;
  roastDate: string;
  roastLevel: string;
  beanType?: CoffeeBean['beanType'] | null;
  notes: string;
  flavor?: string[];
  startDay?: number;
  endDay?: number;
}

export class RoastingValidationError extends Error {
  constructor(
    message: string,
    public readonly field: string
  ) {
    super(message);
    this.name = 'RoastingValidationError';
  }
}

export interface RoastingCommand {
  noteId: string;
  beanId: string;
  now: number;
  draft?: RoastingDraft;
  legacyEdit?: {
    greenBeanId: string;
    amount: number;
    timestamp: number;
    inputs?: RoastingInput[];
  };
  expectedUpdatedAt?: number;
  expectedOutputTimestamp?: number;
}

export interface RoastingChanges {
  beans: CoffeeBean[];
  note?: BrewingNote;
  deletedNoteId?: string;
  deletedBeanId?: string;
  imageSourceId?: string;
}

export const sourceBeanIds = (bean: CoffeeBean): string[] =>
  bean.sourceGreenBeanIds ??
  (bean.sourceGreenBeanId ? [bean.sourceGreenBeanId] : []);

export const roastingInputs = (
  record: NonNullable<BrewingNote['changeRecord']>['roastingRecord']
): RoastingInput[] =>
  record?.inputs ??
  (record
    ? [
        {
          greenBeanId: record.greenBeanId,
          greenBeanName: record.greenBeanName,
          amount: record.roastedAmount,
        },
      ]
    : []);

export const noteUsesBean = (note: BrewingNote, id: string): boolean =>
  note.beanId === id ||
  (note.source === 'roasting' &&
    roastingInputs(note.changeRecord?.roastingRecord).some(
      input => input.greenBeanId === id
    ));

export const roundGrams = (amount: number): number =>
  Math.round(amount * 1000) / 1000;

/** Validate and calculate against records read inside the persistence transaction. */
export function prepareRoastingBatch(
  command: RoastingCommand,
  beans: CoffeeBean[],
  previous?: BrewingNote,
  notes: BrewingNote[] = []
): RoastingChanges {
  const { draft, noteId, beanId } = command;
  const now = Math.max(
    command.now,
    (previous?.updatedAt ?? previous?.timestamp ?? 0) + 1
  );
  const old = previous?.changeRecord?.roastingRecord;
  if (
    command.expectedUpdatedAt !== undefined &&
    (!previous ||
      (previous.updatedAt ?? previous.timestamp) !== command.expectedUpdatedAt)
  ) {
    throw new Error('烘焙记录已变化，请重新打开后保存');
  }
  if (command.legacyEdit) {
    const edit = command.legacyEdit;
    if (!previous || previous.source !== 'roasting' || !old)
      throw new Error('找不到有效的烘焙记录');
    const oldInputs = roastingInputs(old);
    const inputs =
      oldInputs.length > 1
        ? (edit.inputs ?? [])
        : [
            {
              greenBeanId: edit.greenBeanId,
              greenBeanName: '',
              amount: edit.amount,
            },
          ];
    if (
      !inputs.length ||
      new Set(inputs.map(input => input.greenBeanId)).size !== inputs.length ||
      [...oldInputs, ...inputs].some(
        input =>
          !Number.isFinite(input.amount) ||
          input.amount <= 0 ||
          roundGrams(input.amount) !== input.amount
      ) ||
      (oldInputs.length > 1 &&
        (inputs.length !== oldInputs.length ||
          inputs.some(
            input =>
              !oldInputs.some(
                oldInput => oldInput.greenBeanId === input.greenBeanId
              )
          )))
    )
      throw new Error('投豆明细有误，请重新打开记录');
    const amount = roundGrams(
      inputs.reduce((total, input) => total + input.amount, 0)
    );
    if (
      !Number.isFinite(edit.amount) ||
      edit.amount <= 0 ||
      (oldInputs.length === 1 && roundGrams(edit.amount) !== edit.amount) ||
      !Number.isFinite(old.roastedAmount) ||
      old.roastedAmount <= 0 ||
      !Number.isFinite(edit.timestamp)
    )
      throw new Error('原始或新的烘焙数据无效');
    const output = beans.find(bean => bean.id === old.roastedBeanId);
    if (
      old.roastedBeanId &&
      (!output ||
        output.beanState === 'green' ||
        sourceBeanIds(output).length !== oldInputs.length ||
        oldInputs.some(
          input => !sourceBeanIds(output).includes(input.greenBeanId)
        ))
    )
      throw new Error('关联熟豆已删除或来源已变化，无法编辑烘焙');
    if (old.outputAmount !== undefined && amount < old.outputAmount)
      throw new Error('投豆量不能小于原出豆量');
    const changed: CoffeeBean[] = [];
    for (const id of new Set(
      [...oldInputs, ...inputs].map(input => input.greenBeanId)
    )) {
      const bean = beans.find(bean => bean.id === id);
      if (!bean || bean.beanState !== 'green' || bean.isInTransit)
        throw new Error('来源生豆已删除、改变或未到货，无法编辑烘焙');
      const remaining = parseCoffeeBeanAmount(bean.remaining);
      const capacity = parseCoffeeBeanAmount(bean.capacity);
      const next = roundGrams(
        (remaining ?? NaN) +
          (oldInputs.find(input => input.greenBeanId === id)?.amount ?? 0) -
          (inputs.find(input => input.greenBeanId === id)?.amount ?? 0)
      );
      if (
        remaining === null ||
        remaining < 0 ||
        !Number.isFinite(next) ||
        next < 0 ||
        (next > remaining && (capacity === null || next > capacity))
      )
        throw new Error('生豆库存不足或返还后超过总量，请先核对库存');
      if (next !== remaining)
        changed.push({
          ...bean,
          remaining: String(next),
          timestamp: Math.max(now, bean.timestamp + 1),
        });
    }
    if (
      output &&
      oldInputs.length === 1 &&
      edit.greenBeanId !== old.greenBeanId
    )
      changed.push({
        ...output,
        sourceGreenBeanId: edit.greenBeanId,
        sourceGreenBeanIds: output.sourceGreenBeanIds
          ? [edit.greenBeanId]
          : undefined,
        timestamp: Math.max(now, output.timestamp + 1),
      });
    const resolvedInputs = inputs.map(input => {
      const source = beans.find(bean => bean.id === input.greenBeanId)!;
      const prior = oldInputs.find(
        oldInput => oldInput.greenBeanId === input.greenBeanId
      );
      const price = parseCoffeeBeanAmount(source.price);
      const capacity = parseCoffeeBeanAmount(source.capacity);
      const unitCost =
        prior?.cost !== undefined
          ? prior.cost / prior.amount
          : price !== null && capacity !== null && capacity > 0
            ? price / capacity
            : undefined;
      return {
        ...input,
        greenBeanName: formatCoffeeBeanDisplayName(source),
        ...(old.inputs
          ? {
              cost:
                unitCost === undefined ? undefined : unitCost * input.amount,
            }
          : {}),
      };
    });
    const inputsChanged = resolvedInputs.some(
      (input, index) =>
        input.greenBeanId !== oldInputs[index]?.greenBeanId ||
        input.amount !== oldInputs[index]?.amount
    );
    const editedDate = new Date(edit.timestamp);
    const roastDate =
      edit.timestamp === previous.timestamp
        ? old.roastDate
        : `${editedDate.getFullYear()}-${String(editedDate.getMonth() + 1).padStart(2, '0')}-${String(editedDate.getDate()).padStart(2, '0')}`;
    if (
      old.inputs &&
      output &&
      (inputsChanged || roastDate !== old.roastDate)
    ) {
      const updatedOutput = changed.find(bean => bean.id === output.id) ?? {
        ...output,
      };
      if (inputsChanged)
        updatedOutput.price = resolvedInputs.every(
          input => input.cost !== undefined
        )
          ? resolvedInputs
              .reduce((total, input) => total + input.cost!, 0)
              .toFixed(2)
          : undefined;
      updatedOutput.roastDate = roastDate;
      updatedOutput.timestamp = Math.max(now, output.timestamp + 1);
      if (!changed.includes(updatedOutput)) changed.push(updatedOutput);
    }
    const source = beans.find(bean => bean.id === inputs[0].greenBeanId)!;
    const sourceName = resolvedInputs
      .map(input => input.greenBeanName)
      .join(' + ');
    return {
      beans: changed,
      note: {
        ...previous,
        timestamp: edit.timestamp,
        updatedAt: now,
        beanId: inputs.length === 1 ? source.id : undefined,
        coffeeBeanInfo: {
          ...previous.coffeeBeanInfo,
          name: sourceName,
          ...(old.inputs ? { roastDate } : {}),
          roastLevel:
            previous.coffeeBeanInfo?.roastLevel || source.roastLevel || '未知',
        },
        notes: old.inputs
          ? `投入 ${amount}g 生豆 → ${old.roastedBeanName ?? ''} ${old.outputAmount ?? ''}g\n${resolvedInputs.map(input => `${input.greenBeanName} · ${roundGrams((input.amount / amount) * 100)}% · ${input.amount}g`).join('\n')}${output?.notes ? `\n${output.notes}` : ''}`
          : `烘焙了 ${amount}g 生豆${old.roastedBeanName ? ` → ${old.roastedBeanName}` : ''}`,
        changeRecord: {
          ...previous.changeRecord,
          roastingRecord: {
            ...old,
            greenBeanId: inputs.length === 1 ? source.id : '',
            greenBeanName: sourceName,
            roastedAmount: amount,
            ...(old.inputs ? { inputs: resolvedInputs, roastDate } : {}),
          },
        },
      },
    };
  }
  if (!draft) {
    if (!previous || previous.source !== 'roasting' || !old)
      throw new Error('找不到有效的烘焙记录');
    const output = beans.find(bean => bean.id === old.roastedBeanId);
    const inputs = roastingInputs(old);
    if (
      !Array.isArray(inputs) ||
      !inputs.length ||
      inputs.some(
        input =>
          !input?.greenBeanId ||
          !Number.isFinite(input.amount) ||
          input.amount <= 0 ||
          roundGrams(input.amount) !== input.amount
      ) ||
      new Set(inputs.map(input => input.greenBeanId)).size !== inputs.length
    )
      throw new Error('这条记录缺少投豆量，暂时无法撤销。');
    if (
      old.roastedBeanId &&
      notes.some(
        note =>
          note.id !== noteId &&
          (noteUsesBean(note, old.roastedBeanId!) ||
            note.changeRecord?.roastingRecord?.roastedBeanId ===
              old.roastedBeanId)
      )
    )
      throw new RoastingValidationError(
        '这批熟豆已有冲煮或用量记录，暂时无法撤销。',
        'form'
      );
    if (
      output &&
      (output.beanState === 'green' ||
        !Number.isFinite(old.outputAmount) ||
        parseCoffeeBeanAmount(output.capacity) !== old.outputAmount ||
        parseCoffeeBeanAmount(output.remaining) !== old.outputAmount ||
        sourceBeanIds(output).length !== inputs.length ||
        inputs.some(
          input => !sourceBeanIds(output).includes(input.greenBeanId)
        ))
    )
      throw new Error(
        !Number.isFinite(old.outputAmount)
          ? '这条记录缺少出豆量，暂时无法撤销。'
          : output.beanState === 'green' ||
              sourceBeanIds(output).length !== inputs.length ||
              inputs.some(
                input => !sourceBeanIds(output).includes(input.greenBeanId)
              )
            ? '这批熟豆的来源已更改，暂时无法撤销。'
            : '这批熟豆已用过或调整过用量，暂时无法撤销。'
      );
    const restored = inputs.map(input => {
      const source = beans.find(bean => bean.id === input.greenBeanId);
      if (!source || source.beanState !== 'green')
        throw new Error(
          source
            ? '原来的生豆已改为熟豆，无法退回投豆量。'
            : '原来的生豆已删除，无法退回投豆量。'
        );
      const remaining = parseCoffeeBeanAmount(source.remaining);
      const capacity = parseCoffeeBeanAmount(source.capacity);
      const next = roundGrams((remaining ?? NaN) + input.amount);
      if (
        !Number.isFinite(next) ||
        remaining === null ||
        remaining < 0 ||
        capacity === null ||
        next > capacity
      )
        throw new Error(
          capacity !== null && next > capacity
            ? '退回后会超过生豆总量，请先检查生豆余量。'
            : '生豆用量有误，请先检查总量和余量。'
        );
      return {
        ...source,
        remaining: String(next),
        timestamp: Math.max(now, source.timestamp + 1),
      };
    });
    return {
      beans: restored,
      deletedNoteId: noteId,
      deletedBeanId: output?.id,
    };
  }
  if (previous && !old?.inputs) throw new Error('旧烘焙记录请使用原编辑入口');
  if (
    old?.inputs &&
    (!Array.isArray(old.inputs) ||
      !old.inputs.length ||
      old.inputs.some(
        input =>
          !input.greenBeanId ||
          !Number.isFinite(input.amount) ||
          input.amount <= 0
      ) ||
      new Set(old.inputs.map(input => input.greenBeanId)).size !==
        old.inputs.length ||
      !Number.isFinite(old.outputAmount) ||
      old.outputAmount! <= 0)
  )
    throw new Error('原烘焙记录的投入或产出数据无效，无法调整库存');
  if (!previous && beans.some(bean => bean.id === beanId))
    throw new Error('熟豆记录已存在，请重新打开');
  const output = beans.find(bean => bean.id === (old?.roastedBeanId ?? beanId));
  if (
    command.expectedOutputTimestamp !== undefined &&
    output?.timestamp !== command.expectedOutputTimestamp
  )
    throw new Error('熟豆信息或库存已变化，请重新打开后保存');
  if (
    draft &&
    previous &&
    output &&
    (output.beanState === 'green' ||
      sourceBeanIds(output).length !== old!.inputs!.length ||
      old!.inputs!.some(
        input => !sourceBeanIds(output).includes(input.greenBeanId)
      ))
  )
    throw new Error('熟豆来源已变化，无法修改这条烘焙记录');
  if (!draft.name.trim()) throw new Error('请填写熟豆名称');
  for (const day of [draft.startDay, draft.endDay]) {
    if (day !== undefined && (!Number.isFinite(day) || day < 0))
      throw new RoastingValidationError('赏味期天数须为零或正数', 'form');
  }
  if (
    draft.beanType != null &&
    !['espresso', 'filter', 'omni'].includes(draft.beanType)
  )
    throw new Error('请选择有效的咖啡豆类型');
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(draft.roastDate) ||
    !Number.isFinite(Date.parse(draft.roastDate)) ||
    new Date(draft.roastDate).toISOString().slice(0, 10) !== draft.roastDate
  )
    throw new Error('请选择有效的烘焙日期');
  if (
    !draft.inputs.length ||
    new Set(draft.inputs.map(input => input.greenBeanId)).size !==
      draft.inputs.length
  )
    throw new Error('请选择不重复的生豆');
  if (
    draft.inputs.some(
      input =>
        !Number.isFinite(input.amount) ||
        input.amount <= 0 ||
        roundGrams(input.amount) !== input.amount
    )
  )
    throw new Error('每款投豆量须大于零，最多保留三位小数');
  const total = roundGrams(
    draft.inputs.reduce((sum, input) => sum + input.amount, 0)
  );
  if (
    !Number.isFinite(total) ||
    total <= 0 ||
    !Number.isSafeInteger(Math.round(total * 1000))
  )
    throw new Error('投豆总量无效');
  if (
    !Number.isFinite(draft.outputAmount) ||
    draft.outputAmount <= 0 ||
    draft.outputAmount > total ||
    roundGrams(draft.outputAmount) !== draft.outputAmount
  )
    throw new Error('出豆量须大于零且不超过投豆量，最多保留三位小数');
  if (previous && !output) throw new Error('关联熟豆已删除，无法修改烘焙');
  const previousInputs = old?.inputs ?? [];
  const ids = new Set(
    [...previousInputs, ...draft.inputs].map(input => input.greenBeanId)
  );
  const changed: CoffeeBean[] = [];
  for (const id of ids) {
    const bean = beans.find(item => item.id === id);
    if (!bean || bean.beanState !== 'green' || bean.isInTransit)
      throw new RoastingValidationError(
        '来源生豆已删除、改变或尚未到货，请重新选择',
        id
      );
    const remaining = parseCoffeeBeanAmount(bean.remaining);
    if (remaining === null || remaining < 0)
      throw new RoastingValidationError('生豆库存无效', id);
    const amount =
      draft.inputs.find(input => input.greenBeanId === id)?.amount ?? 0;
    const returned =
      previousInputs.find(input => input.greenBeanId === id)?.amount ?? 0;
    const next = roundGrams(remaining + returned - amount);
    if (!Number.isFinite(next) || next < 0)
      throw new RoastingValidationError(
        `库存不足，可用 ${roundGrams(remaining + returned)}g`,
        id
      );
    const sourceCapacity = parseCoffeeBeanAmount(bean.capacity);
    if (returned > amount && (sourceCapacity === null || next > sourceCapacity))
      throw new RoastingValidationError(
        '返还后生豆余量将超过总量，请先核对库存',
        id
      );
    if (next !== remaining)
      changed.push({
        ...bean,
        remaining: String(next),
        timestamp: Math.max(now, bean.timestamp + 1),
      });
  }
  const sources = draft.inputs.map(
    input => beans.find(bean => bean.id === input.greenBeanId)!
  );
  const inputs: RoastingInput[] = draft.inputs.map((input, index) => {
    const source = sources[index];
    const price = parseCoffeeBeanAmount(source.price);
    const capacity = parseCoffeeBeanAmount(source.capacity);
    const prior = previousInputs.find(item => item.greenBeanId === source.id);
    const unitCost = prior
      ? prior.cost === undefined
        ? undefined
        : prior.cost / prior.amount
      : price !== null && capacity
        ? price / capacity
        : undefined;
    return {
      ...input,
      greenBeanName:
        prior?.greenBeanName ?? formatCoffeeBeanDisplayName(source),
      cost: unitCost === undefined ? undefined : unitCost * input.amount,
    };
  });
  const single = sources.length === 1 ? sources[0] : undefined;
  const components = sources.flatMap(source =>
    (source.blendComponents ?? []).map(part => {
      if (single) return { ...part };
      // 各来源内部的成分比例不属于整批拼配，投豆占比保留在烘焙记录中。
      const { percentage: _percentage, ...fields } = part;
      return fields;
    })
  );
  const consumed = output
    ? roundGrams(
        (parseCoffeeBeanAmount(output.capacity) ?? NaN) -
          (parseCoffeeBeanAmount(output.remaining) ?? NaN)
      )
    : 0;
  const delta = previous ? draft.outputAmount - (old?.outputAmount ?? 0) : 0;
  const capacity = output
    ? roundGrams((parseCoffeeBeanAmount(output.capacity) ?? NaN) + delta)
    : draft.outputAmount;
  const remaining = roundGrams(capacity - consumed);
  if (!Number.isFinite(remaining) || remaining < 0 || consumed < 0)
    throw new RoastingValidationError('出豆量不足以覆盖熟豆已使用量', 'amount');
  const inputsChanged =
    previousInputs.length !== draft.inputs.length ||
    previousInputs.some(
      (input, index) =>
        input.greenBeanId !== draft.inputs[index]?.greenBeanId ||
        input.amount !== draft.inputs[index]?.amount
    );
  const roasted: CoffeeBean = {
    ...(output ?? {
      id: beanId,
      flavor: single?.flavor,
      blendComponents: components,
    }),
    id: output?.id ?? beanId,
    timestamp: Math.max(now, (output?.timestamp ?? 0) + 1),
    name: draft.name.trim(),
    roaster:
      draft.roaster === undefined
        ? (output?.roaster ?? single?.roaster)
        : draft.roaster.trim(),
    beanState: 'roasted',
    beanType:
      draft.beanType === null
        ? undefined
        : (draft.beanType ?? output?.beanType ?? single?.beanType),
    capacity: String(capacity),
    remaining: String(remaining),
    roastDate: draft.roastDate,
    roastLevel: draft.roastLevel,
    startDay:
      draft.startDay === undefined
        ? output?.startDay
        : draft.startDay || undefined,
    endDay:
      draft.endDay === undefined ? output?.endDay : draft.endDay || undefined,
    notes: draft.notes,
    flavor:
      draft.flavor === undefined
        ? (output?.flavor ?? single?.flavor)
        : normalizeFlavorList(draft.flavor),
    price:
      output && !inputsChanged
        ? output.price
        : inputs.every(input => input.cost !== undefined)
          ? inputs.reduce((sum, input) => sum + input.cost!, 0).toFixed(2)
          : undefined,
    sourceGreenBeanIds: inputs.map(input => input.greenBeanId),
    sourceGreenBeanId: single?.id,
  };
  if (previous && inputsChanged) roasted.blendComponents = components;
  const note: BrewingNote = {
    ...previous,
    id: noteId,
    timestamp: previous?.timestamp ?? now,
    updatedAt: now,
    source: 'roasting',
    beanId: single?.id,
    coffeeBeanInfo: {
      name: inputs.map(input => input.greenBeanName).join(' + '),
      roastLevel: draft.roastLevel,
      roastDate: draft.roastDate,
    },
    rating: 0,
    taste: {},
    notes: `投入 ${total}g 生豆 → ${formatCoffeeBeanDisplayName(roasted)} ${draft.outputAmount}g\n${inputs.map(input => `${input.greenBeanName} · ${roundGrams((input.amount / total) * 100)}% · ${input.amount}g`).join('\n')}${draft.notes ? `\n${draft.notes}` : ''}`,
    changeRecord: {
      roastingRecord: {
        inputs,
        outputAmount: draft.outputAmount,
        roastDate: draft.roastDate,
        greenBeanId: single?.id ?? '',
        greenBeanName: inputs.map(input => input.greenBeanName).join(' + '),
        roastedAmount: total,
        roastedBeanId: roasted.id,
        roastedBeanName: formatCoffeeBeanDisplayName(roasted),
      },
    },
  };
  return {
    beans: [...changed, roasted],
    note,
    imageSourceId: !previous ? single?.id : undefined,
  };
}
