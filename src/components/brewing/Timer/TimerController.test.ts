import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { handleTimerTick, startMainTimer } from './TimerController';
import { playTimerSound } from './Audio';
import type { ExpandedStage } from './types';

vi.mock('./Audio', () => ({ playTimerSound: vi.fn() }));

const stages: ExpandedStage[] = [
  {
    type: 'wait',
    label: '等待',
    startTime: 0,
    endTime: 3,
    time: 3,
    water: '100g',
    detail: '',
    originalIndex: 0,
  },
];

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
});
afterEach(() => vi.useRealTimers());

it('plays each cue once when a pour boundary coincides with a stage boundary', () => {
  const pourStages: ExpandedStage[] = [{ ...stages[0], type: 'pour' }];
  const onHaptic = vi.fn();
  handleTimerTick(1, pourStages, true, true, onHaptic);
  expect(playTimerSound).toHaveBeenCalledExactlyOnceWith('start', true);
  vi.clearAllMocks();
  handleTimerTick(
    2,
    [...pourStages, { ...stages[0], startTime: 3, endTime: 6 }],
    true,
    true,
    onHaptic
  );
  expect(playTimerSound).toHaveBeenCalledExactlyOnceWith('ding', true);
  expect(onHaptic).toHaveBeenCalledExactlyOnceWith('medium');
});

it('completes at the final boundary once and stops without caller cleanup', () => {
  const onTick = vi.fn();
  const onComplete = vi.fn();
  startMainTimer(0, stages, false, false, { onTick, onComplete });
  vi.advanceTimersByTime(2000);
  expect(onComplete).not.toHaveBeenCalled();
  vi.advanceTimersByTime(1000);
  expect(onTick.mock.calls.map(([time]) => time)).toEqual([1, 2, 3]);
  expect(onComplete).toHaveBeenCalledTimes(1);
  vi.advanceTimersByTime(5000);
  expect(onComplete).toHaveBeenCalledTimes(1);
  expect(onTick).toHaveBeenCalledTimes(3);
});

it('resumes from the displayed time after cancellation and starts a new brew at zero', () => {
  let displayedTime = 0;
  const onComplete = vi.fn();
  const callbacks = {
    onTick: (time: number) => {
      displayedTime = time;
    },
    onComplete,
  };
  const timer = startMainTimer(0, stages, false, false, callbacks);
  vi.advanceTimersByTime(1000);
  clearInterval(timer);
  vi.advanceTimersByTime(5000);
  expect(displayedTime).toBe(1);
  startMainTimer(displayedTime, stages, false, false, callbacks);
  vi.advanceTimersByTime(2000);
  expect(displayedTime).toBe(3);
  expect(onComplete).toHaveBeenCalledTimes(1);
  const nextTimer = startMainTimer(0, stages, false, false, callbacks);
  vi.advanceTimersByTime(1000);
  expect(displayedTime).toBe(1);
  clearInterval(nextTimer);
});

it('cancels automatic completion when the user skips or resets', () => {
  const onComplete = vi.fn();
  const timer = startMainTimer(0, stages, false, false, {
    onTick: vi.fn(),
    onComplete,
  });
  vi.advanceTimersByTime(2000);
  clearInterval(timer);
  vi.advanceTimersByTime(5000);
  expect(onComplete).not.toHaveBeenCalled();
});
