import { describe, expect, it } from 'vitest';
import { getPullDistance, isAtTop } from './PullToSync';

describe('navigation pull-to-sync gesture', () => {
  it('ignores jitter and cancels upward or horizontal gestures', () => {
    expect(getPullDistance(2, 5)).toBe(0);
    expect(getPullDistance(40, 12)).toBeNull();
    expect(getPullDistance(-40, 12)).toBeNull();
    expect(getPullDistance(0, -1)).toBeNull();
    expect(getPullDistance(5, 120)).toBe(120);
  });

  it('retracts below the threshold when the finger moves back up', () => {
    expect(getPullDistance(0, 140)).toBe(140);
    expect(getPullDistance(0, 60)).toBe(60);
    expect(getPullDistance(0, 2)).toBe(0);
  });

  it('checks only the gesture surface, not the page or unrelated lists', () => {
    const outer = { scrollTop: 300, parentElement: null };
    const boundary = {
      scrollTop: 0,
      parentElement: outer,
    } as unknown as HTMLElement;
    const child = {
      scrollTop: 0,
      parentElement: boundary,
    } as unknown as HTMLElement;
    expect(isAtTop(child, boundary)).toBe(true);
    child.scrollTop = 20;
    expect(isAtTop(child, boundary)).toBe(false);
    expect(
      isAtTop(
        { scrollTop: 0, parentElement: null } as unknown as HTMLElement,
        boundary
      )
    ).toBe(false);
  });
});
