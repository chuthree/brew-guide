const DOM_DELTA_PIXEL = 0;
const DOM_DELTA_LINE = 1;
const DOM_DELTA_PAGE = 2;
const LINE_HEIGHT_IN_PX = 16;

export interface WheelDeltaLike {
  deltaMode: number;
  deltaX: number;
  deltaY: number;
  ctrlKey?: boolean;
}

export interface HorizontalScrollState {
  scrollLeft: number;
  scrollWidth: number;
  clientWidth: number;
  delta: number;
}

export interface HorizontalScrollResult {
  nextScrollLeft: number;
  shouldConsume: boolean;
}

export function getHorizontalWheelDelta(
  event: WheelDeltaLike,
  pageWidth: number
): number {
  if (event.ctrlKey) return 0;

  const rawDelta =
    Math.abs(event.deltaX) > Math.abs(event.deltaY)
      ? event.deltaX
      : event.deltaY;

  switch (event.deltaMode) {
    case DOM_DELTA_LINE:
      return rawDelta * LINE_HEIGHT_IN_PX;
    case DOM_DELTA_PAGE:
      return rawDelta * pageWidth;
    case DOM_DELTA_PIXEL:
    default:
      return rawDelta;
  }
}

export function getNextHorizontalScrollLeft({
  scrollLeft,
  scrollWidth,
  clientWidth,
  delta,
}: HorizontalScrollState): HorizontalScrollResult {
  const maxScrollLeft = Math.max(0, scrollWidth - clientWidth);

  if (maxScrollLeft <= 0 || delta === 0) {
    return { nextScrollLeft: scrollLeft, shouldConsume: false };
  }

  const nextScrollLeft = Math.min(
    maxScrollLeft,
    Math.max(0, scrollLeft + delta)
  );

  return {
    nextScrollLeft,
    shouldConsume: nextScrollLeft !== scrollLeft,
  };
}
