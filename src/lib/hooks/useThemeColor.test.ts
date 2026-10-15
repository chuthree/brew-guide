import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const animations = vi.hoisted(() => ({
  calls: [] as {
    from: number;
    to: number;
    options: {
      duration: number;
      ease: number[];
      onUpdate: (value: number) => void;
    };
    stop: ReturnType<typeof vi.fn>;
  }[],
}));
vi.mock('framer-motion', () => ({
  animate: (
    from: number,
    to: number,
    options: (typeof animations.calls)[number]['options']
  ) => {
    const call = { from, to, options, stop: vi.fn() };
    animations.calls.push(call);
    return { stop: call.stop };
  },
}));
import {
  registerThemeColorOverlay,
  restoreDefaultThemeColor,
} from './useThemeColor';

function style() {
  const values = new Map<string, string>();
  return {
    opacity: '',
    transition: '',
    transitionDuration: '',
    setProperty: vi.fn((key: string, value: string) => values.set(key, value)),
    getPropertyValue: (key: string) => values.get(key) || '',
    removeProperty: vi.fn((key: string) => values.delete(key)),
  };
}

describe('one scrim/color progress writer', () => {
  let rootStyle: ReturnType<typeof style>;
  let meta: { content: string; removeAttribute: ReturnType<typeof vi.fn> };
  const cleanups: (() => void)[] = [];
  let observers: (() => void)[];
  let inlineSource = false;

  const makeOverlay = () => ({
    style: style(),
    dataset: {} as Record<string, string>,
    hasAttribute: (name: string) => name === 'data-vaul-overlay',
  });
  const bind = (element: ReturnType<typeof makeOverlay>) => {
    const binding = registerThemeColorOverlay(
      element as unknown as HTMLElement
    );
    cleanups.push(binding.dispose);
    return binding;
  };

  beforeEach(() => {
    rootStyle = style();
    meta = { content: '', removeAttribute: vi.fn() };
    animations.calls.length = 0;
    observers = [];
    inlineSource = false;
    vi.stubGlobal('document', {
      documentElement: { style: rootStyle },
      querySelector: () => meta,
    });
    vi.stubGlobal('getComputedStyle', () =>
      inlineSource
        ? {
            animationName: 'none',
            transitionDuration: '0s',
            transitionTimingFunction: 'ease',
          }
        : {
            animationName: 'fadeIn',
            animationDuration: '0.5s',
            animationTimingFunction: 'cubic-bezier(0.32, 0.72, 0, 1)',
          }
    );
    vi.stubGlobal(
      'MutationObserver',
      class {
        constructor(callback: () => void) {
          observers.push(callback);
        }
        observe() {}
        disconnect = vi.fn();
      }
    );
    restoreDefaultThemeColor('light', undefined);
  });

  afterEach(() => {
    cleanups.splice(0).forEach(dispose => dispose());
    vi.unstubAllGlobals();
  });

  it('updates visible scrim, document/strip color and meta in the same callback', () => {
    const element = makeOverlay();
    const binding = bind(element);
    binding.setOpen(true);
    const animation = animations.calls[0];
    expect(animation.options.duration).toBe(0.5);
    expect(animation.options.ease).toEqual([0.32, 0.72, 0, 1]);
    animation.options.onUpdate(0.5);
    expect(element.style.getPropertyValue('--browser-overlay-progress')).toBe(
      '0.5'
    );
    expect(rootStyle.getPropertyValue('--edge-top-background')).toBe(
      'rgb(188, 188, 188)'
    );
    expect(meta.content).toBe(
      rootStyle.getPropertyValue('--edge-top-background')
    );
    animation.options.onUpdate(1);
    expect(meta.content).toBe('rgb(125, 125, 125)');
    binding.setOpen(false);
    const exit = animations.calls.at(-1)!;
    expect(exit.from).toBe(1);
    expect(exit.to).toBe(0);
    // Closing keeps the color until the exit has actually progressed.
    expect(meta.content).toBe('rgb(125, 125, 125)');
    exit.options.onUpdate(0);
    expect(meta.content).toBe('rgb(250, 250, 250)');
  });

  it('composes nested scrims and restores the remaining layer', () => {
    const outer = bind(makeOverlay());
    outer.setOpen(true);
    animations.calls.at(-1)!.options.onUpdate(1);
    const inner = bind(makeOverlay());
    inner.setOpen(true);
    animations.calls.at(-1)!.options.onUpdate(1);
    expect(meta.content).toBe('rgb(63, 63, 63)');
    outer.dispose();
    expect(meta.content).toBe('rgb(125, 125, 125)');
    restoreDefaultThemeColor('system', 'dark');
    expect(meta.content).toBe('rgb(12, 12, 12)');
  });

  it('hands off drag, release and reversal from the current value', () => {
    const element = makeOverlay();
    const binding = bind(element);
    binding.setOpen(true);
    animations.calls[0].options.onUpdate(0.7);
    element.style.opacity = '0.25';
    element.style.transition = 'none';
    observers[0]();
    expect(animations.calls[0].stop).toHaveBeenCalled();
    expect(meta.content).toBe('rgb(219, 219, 219)');
    element.style.opacity = '1';
    element.style.transition = 'opacity .5s cubic-bezier(.32,.72,0,1)';
    observers[0]();
    expect(animations.calls.at(-1)!.from).toBe(0.25);
    expect(animations.calls.at(-1)!.to).toBe(1);
    binding.setOpen(false);
    expect(animations.calls.at(-1)!.from).toBe(0.25);
    expect(animations.calls.at(-1)!.to).toBe(0);
  });

  it('applies zero-duration motion atomically without creating a fallback fade', () => {
    inlineSource = true;
    const element = makeOverlay();
    const binding = bind(element);
    binding.setOpen(true);
    expect(animations.calls).toHaveLength(0);
    expect(element.style.getPropertyValue('--browser-overlay-progress')).toBe(
      '1'
    );
    expect(meta.content).toBe('rgb(125, 125, 125)');
    binding.setOpen(false);
    expect(element.style.getPropertyValue('--browser-overlay-progress')).toBe(
      '0'
    );
    expect(meta.content).toBe('rgb(250, 250, 250)');
  });
});
