'use client';

import {
  useCallback,
  useEffect,
  useId,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type Ref,
} from 'react';
import {
  animate,
  useMotionValue,
  useMotionValueEvent,
  useReducedMotion,
} from 'framer-motion';
import { Minus, Plus } from 'lucide-react';
import ActionDrawer from '@/components/common/ui/ActionDrawer';
import { useModalHistory } from '@/lib/hooks/useModalHistory';
import type { Grinder, GrinderQuickAdjust } from '@/lib/data/models';
import {
  configureGrinderScale,
  getConfiguredGrinderScale,
  getGrinderScale,
  getNextScaleExample,
  getScaleAt,
  isMajorScaleMark,
  normalizeScaleInput,
  type GrinderScaleForm,
  type GrinderScaleFormErrors,
} from '@/lib/grinder/quickAdjust';

export interface WheelPointer {
  pointerId: number;
  clientX: number;
}

export interface GrinderScaleWheelHandle {
  readChanges: () =>
    { value: string; settings?: GrinderQuickAdjust } | false | null;
}

interface GrinderScaleWheelProps {
  ref: Ref<GrinderScaleWheelHandle>;
  grinder: Grinder;
  openingPointer: WheelPointer | null;
  saving: boolean;
  children: ReactNode;
  onClose: () => void;
  onRestore: () => void;
}

const PIXELS_PER_STEP = 22;
const MARKS = [-5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5];
const STEP_BUTTON =
  'grid size-11 shrink-0 cursor-pointer touch-manipulation place-items-center rounded-full bg-neutral-100 text-neutral-800 transition-[background-color,scale] duration-150 ease-out enabled:hover:bg-neutral-200 enabled:active:bg-neutral-300 focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-default disabled:opacity-40 motion-safe:enabled:active:scale-[0.96] dark:bg-neutral-800 dark:text-neutral-100 dark:enabled:hover:bg-neutral-700 dark:enabled:active:bg-neutral-600';
const INPUT =
  'min-w-0 w-full rounded-lg bg-neutral-100 px-2.5 py-2 text-base text-neutral-900 focus-visible:outline-2 dark:bg-neutral-800 dark:text-neutral-100';

export default function GrinderScaleWheel({
  ref,
  grinder,
  openingPointer,
  saving,
  children,
  onClose,
  onRestore,
}: GrinderScaleWheelProps) {
  const [initial] = useState(() => ({
    value: grinder.currentGrindSize ?? '',
    settings: grinder.quickAdjust,
  }));
  const [base, setBase] = useState(initial.value);
  const [draft, setDraft] = useState<string | null>(null);
  const [preview, setPreview] = useState<GrinderQuickAdjust>();
  const [openedForm, setOpenedForm] = useState<GrinderScaleForm>();
  const [form, setForm] = useState<GrinderScaleForm | null>(null);
  const [formErrors, setFormErrors] = useState<GrinderScaleFormErrors>();
  const formId = useId();
  const cancelSettings = () => setForm(null);
  useModalHistory({
    id: `grinder-scale-settings-${formId}`,
    isOpen: form !== null,
    dismissible: !saving,
    onClose: cancelSettings,
  });
  const [invalidInput, setInvalidInput] = useState(false);
  const inputErrorId = useId();
  const [position, setPosition] = useState(0);
  const travel = useMotionValue(0);
  const [settledOffset, setSettledOffset] = useState(0);
  const reduceMotion = useReducedMotion();
  useMotionValueEvent(travel, 'change', setPosition);
  useEffect(() => () => travel.stop(), [travel]);

  const drag = useRef<(WheelPointer & { offset: number }) | null>(null);
  const activeSettings = preview ?? initial.settings;
  const configured = useMemo(
    () => getConfiguredGrinderScale(activeSettings),
    [activeSettings]
  );
  const scale = useMemo(
    () => getGrinderScale(base, activeSettings),
    [base, activeSettings]
  );
  const offset = Math.round(position);
  const valueAt = (at: number) =>
    at === 0 || !scale ? base : (getScaleAt(scale, at) ?? base);
  const value = valueAt(offset);
  const editValue = draft ?? value;
  const invalidDraft =
    draft !== null && normalizeScaleInput(draft, configured) === null;

  const move = useCallback(
    (newOffset: number, settle = false) => {
      if (!scale) return;
      const next = Math.max(
        scale.minOffset,
        Math.min(scale.maxOffset, newOffset)
      );
      if (settle) setSettledOffset(next);
      if (settle && !reduceMotion) {
        animate(travel, next, { duration: 0.18, ease: 'easeOut' });
      } else {
        travel.stop();
        travel.set(next);
      }
    },
    [reduceMotion, scale, travel]
  );
  const step = (direction: number) =>
    move(settledOffset + direction, true);

  const setCurrentValue = (nextValue: string) => {
    setSettledOffset(0);
    travel.jump(0);
    setBase(nextValue);
    setDraft(null);
    setInvalidInput(false);
  };

  const formChanged =
    form !== null &&
    (['value', 'next', 'min', 'max'] as const).some(
      key => form[key] !== openedForm?.[key]
    );
  const settingsChanged = (['format', 'step', 'min', 'max'] as const).some(
    key => activeSettings?.[key] !== initial.settings?.[key]
  );
  const settledValue = draft ?? valueAt(settledOffset);
  const changed = settledValue !== initial.value || settingsChanged;

  useImperativeHandle(ref, () => ({
    readChanges() {
      if (form && formChanged) {
        const result = configureGrinderScale(form);
        if ('errors' in result) {
          setFormErrors(result.errors);
          return false;
        }
        return {
          value: getScaleAt(result.scale, 0) ?? form.value.trim(),
          settings: result.settings,
        };
      }
      const raw = settledValue;
      if (raw === initial.value && !settingsChanged) return null;
      const nextValue = normalizeScaleInput(raw, configured);
      if (!nextValue) {
        setInvalidInput(true);
        return false;
      }
      return { value: nextValue, settings: preview };
    },
  }));

  useEffect(() => {
    if (!openingPointer || !scale) return;
    const controller = new AbortController();
    const options = { signal: controller.signal, capture: true };
    const movePointer = (event: PointerEvent) => {
      if (event.pointerId === openingPointer.pointerId) {
        move((openingPointer.clientX - event.clientX) / PIXELS_PER_STEP);
      }
    };
    const finish = (event: PointerEvent) => {
      if (event.pointerId !== openingPointer.pointerId) return;
      move(event.type === 'pointercancel' ? 0 : Math.round(travel.get()), true);
      controller.abort();
    };
    window.addEventListener('pointermove', movePointer, options);
    window.addEventListener('pointerup', finish, options);
    window.addEventListener('pointercancel', finish, options);
    window.addEventListener('lostpointercapture', finish, options);
    return () => controller.abort();
  }, [openingPointer, scale, move, travel]);

  const restore = () => {
    setPreview(undefined);
    setCurrentValue(initial.value);
    onRestore();
  };
  const restoreButton = changed && (
    <button
      type="button"
      disabled={saving}
      className="absolute top-0 right-0 cursor-pointer rounded-full bg-neutral-100 px-2.5 py-1.5 text-xs font-medium text-neutral-700 transition-colors before:absolute before:-inset-y-2 before:inset-x-0 enabled:hover:bg-neutral-200 enabled:active:bg-neutral-300 focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-default disabled:opacity-40 dark:bg-neutral-800 dark:text-neutral-300 dark:enabled:hover:bg-neutral-700 dark:enabled:active:bg-neutral-600"
      onClick={restore}
    >
      还原
    </button>
  );
  if (form) {
    const fields = [
      { key: 'value', label: '起始刻度', placeholder: '如 24、5.2 或 1.0.2' },
      { key: 'next', label: '下一格（选填）', placeholder: '默认末位加 1' },
      { key: 'min', label: '最小刻度（选填）', placeholder: '默认从 0 开始' },
      { key: 'max', label: '最大刻度（选填）', placeholder: '未设上限' },
    ] as const;
    return (
      <form
        className="mt-5"
        onSubmit={event => {
          event.preventDefault();
          const result = configureGrinderScale(form);
          if ('errors' in result) {
            setFormErrors(result.errors);
            return;
          }
          setPreview(result.settings);
          setCurrentValue(getScaleAt(result.scale, 0) ?? form.value.trim());
          setForm(null);
        }}
      >
        <ActionDrawer.Content className="grid grid-cols-2 gap-2 space-y-0">
          {fields.map(({ key, label, placeholder }) => {
            const id = `${formId}-${key}`;
            const error = formErrors?.[key];
            return (
              <div key={key} className="flex min-w-0 flex-col gap-1">
                <label
                  htmlFor={id}
                  className="text-xs text-neutral-500 dark:text-neutral-400"
                >
                  {label}
                </label>
                <input
                  id={id}
                  className={INPUT}
                  aria-invalid={error ? true : undefined}
                  aria-describedby={error ? `${id}-error` : undefined}
                  inputMode="decimal"
                  autoComplete="off"
                  maxLength={300}
                  placeholder={placeholder}
                  value={form[key]}
                  disabled={saving}
                  onChange={event => {
                    const nextForm = { ...form, [key]: event.target.value };
                    setForm(nextForm);
                    if (formErrors) {
                      const result = configureGrinderScale(nextForm);
                      setFormErrors(
                        'errors' in result ? result.errors : undefined
                      );
                    }
                  }}
                />
                {error && (
                  <p
                    id={`${id}-error`}
                    role="alert"
                    className="text-xs text-red-600 dark:text-red-400"
                  >
                    {error}
                  </p>
                )}
              </div>
            );
          })}
        </ActionDrawer.Content>
        <ActionDrawer.Actions>
          <ActionDrawer.SecondaryButton
            type="button"
            disabled={saving}
            onClick={cancelSettings}
          >
            取消
          </ActionDrawer.SecondaryButton>
          <ActionDrawer.PrimaryButton type="submit" disabled={saving}>
            应用
          </ActionDrawer.PrimaryButton>
        </ActionDrawer.Actions>
      </form>
    );
  }

  return (
    <>
      {restoreButton}
      <ActionDrawer.Content className="mb-4!">
        <input
          type="text"
          aria-label="研磨度"
          inputMode={scale || configured ? 'decimal' : 'text'}
          aria-invalid={invalidInput}
          aria-describedby={invalidInput ? inputErrorId : undefined}
          autoComplete="off"
          data-vaul-no-drag
          value={editValue}
          disabled={saving}
          placeholder="输入研磨度"
          onChange={event => {
            setInvalidInput(false);
            setDraft(event.target.value);
          }}
          onBlur={() => {
            if (draft === null) return;
            const normalized = normalizeScaleInput(draft, configured);
            if (normalized === null) setInvalidInput(true);
            else setCurrentValue(normalized);
          }}
          onKeyDown={event => {
            if (event.key === 'Enter' && !event.nativeEvent.isComposing)
              onClose();
          }}
          style={{
            fontFamily: 'ui-rounded, "SF Pro Rounded", system-ui, sans-serif',
          }}
          className="mt-5 w-full bg-transparent text-center text-5xl font-bold text-neutral-800 outline-none placeholder:text-neutral-300 dark:text-neutral-100 dark:placeholder:text-neutral-700"
        />
        {invalidInput && (
          <p
            id={inputErrorId}
            role="alert"
            className="text-center text-xs text-red-600 dark:text-red-400"
          >
            {editValue.trim() ? (
              <>
                请输入符合设置的刻度格式，如{' '}
                {activeSettings?.format ??
                  activeSettings?.min ??
                  activeSettings?.max ??
                  activeSettings?.step}
                。
              </>
            ) : (
              '请输入研磨度，或还原本次修改。'
            )}
          </p>
        )}
        <div
          role="group"
          aria-label="研磨刻度轮盘"
          tabIndex={0}
          className="rounded-xl focus-visible:outline-2"
          onKeyDown={event => {
            if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
            if (invalidDraft || saving) return;
            event.preventDefault();
            step(event.key === 'ArrowLeft' ? -1 : 1);
          }}
        >
          <span className="sr-only" aria-live="polite">
            {value}
          </span>
          {scale ? (
            <div
              aria-hidden="true"
              data-vaul-no-drag
              className="relative mx-auto mt-3 h-24 max-w-84 cursor-grab touch-none overflow-hidden select-none active:cursor-grabbing"
              onPointerDown={event => {
                if (
                  !event.isPrimary ||
                  event.button !== 0 ||
                  saving ||
                  invalidDraft
                )
                  return;
                travel.stop();
                event.currentTarget.setPointerCapture(event.pointerId);
                drag.current = {
                  pointerId: event.pointerId,
                  clientX: event.clientX,
                  offset: travel.get(),
                };
              }}
              onPointerMove={event => {
                const start = drag.current;
                if (start?.pointerId !== event.pointerId) return;
                move(
                  start.offset +
                    (start.clientX - event.clientX) / PIXELS_PER_STEP
                );
              }}
              onPointerUp={event => {
                if (drag.current?.pointerId !== event.pointerId) return;
                move(Math.round(travel.get()), true);
                drag.current = null;
              }}
              onPointerCancel={event => {
                if (drag.current?.pointerId !== event.pointerId) return;
                move(settledOffset, true);
                drag.current = null;
              }}
              onLostPointerCapture={() => {
                if (drag.current) move(Math.round(travel.get()), true);
                drag.current = null;
              }}
            >
              <span className="absolute top-0 left-1/2 h-5 w-0.5 -translate-x-1/2 rounded-full bg-neutral-800 dark:bg-neutral-100" />
              {MARKS.map(mark => {
                const tick = offset + mark;
                const label = getScaleAt(scale, tick);
                if (label === null) return null;
                const relative = tick - position;
                const major = isMajorScaleMark(scale, tick);
                return (
                  <div
                    key={tick}
                    className="absolute flex w-0 flex-col items-center"
                    style={{
                      left: `${50 + relative * 8.4}%`,
                      top: 30 + relative ** 2 * 1.25,
                    }}
                  >
                    <span
                      className={
                        major
                          ? 'h-4 w-px bg-neutral-700 dark:bg-neutral-300'
                          : 'h-2.5 w-px bg-neutral-400 dark:bg-neutral-600'
                      }
                      style={{ transform: `rotate(${-relative * 5}deg)` }}
                    />
                    {major && label.length <= 9 && (
                      <span className="mt-1 text-xs whitespace-nowrap text-neutral-500 tabular-nums dark:text-neutral-400">
                        {label}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="mt-3 mb-2 text-center text-xs text-neutral-500 dark:text-neutral-400">
              输入数字刻度后可滑动调节
            </p>
          )}
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              className={STEP_BUTTON}
              aria-label="减一格"
              disabled={
                saving || invalidDraft || !scale || offset <= scale.minOffset
              }
              onClick={() => step(-1)}
            >
              <Minus className="size-5" aria-hidden="true" />
            </button>
            <button
              type="button"
              className="cursor-pointer rounded-full px-3 py-2 text-sm text-neutral-600 dark:text-neutral-300"
              disabled={saving}
              onClick={() => {
                const latest = settledValue;
                const current = getGrinderScale(latest, activeSettings);
                const fields = {
                  value: current ? latest : '',
                  next:
                    current && activeSettings?.step
                      ? getNextScaleExample(current)
                      : '',
                  min: activeSettings?.min ?? '',
                  max: activeSettings?.max ?? '',
                };
                setCurrentValue(latest);
                setFormErrors(undefined);
                setOpenedForm(fields);
                setForm(fields);
              }}
            >
              设置刻度
            </button>
            <button
              type="button"
              className={STEP_BUTTON}
              aria-label="加一格"
              disabled={
                saving || invalidDraft || !scale || offset >= scale.maxOffset
              }
              onClick={() => step(1)}
            >
              <Plus className="size-5" aria-hidden="true" />
            </button>
          </div>
        </div>
      </ActionDrawer.Content>
      {children}
    </>
  );
}
