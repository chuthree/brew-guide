'use client';

import { autoUpdate, offset, shift, size } from '@floating-ui/react';
import type { UseFloatingOptions } from '@floating-ui/react';
import {
  DROPDOWN_MAX_HEIGHT,
  SUGGESTION_DROPDOWN_AVAILABLE_HEIGHT_VAR,
} from './SuggestionDropdown';

const DROPDOWN_VIEWPORT_PADDING = 8;
const DROPDOWN_MIN_HEIGHT = 32;

export const createAutocompleteDropdownMiddleware = (): NonNullable<
  UseFloatingOptions['middleware']
> => [
  offset(4),
  shift({
    padding: DROPDOWN_VIEWPORT_PADDING,
    mainAxis: false,
  }),
  size({
    padding: DROPDOWN_VIEWPORT_PADDING,
    apply({ availableHeight, elements }) {
      const maxHeight = Math.max(
        DROPDOWN_MIN_HEIGHT,
        Math.min(DROPDOWN_MAX_HEIGHT, availableHeight)
      );

      elements.floating.style.setProperty(
        SUGGESTION_DROPDOWN_AVAILABLE_HEIGHT_VAR,
        `${maxHeight}px`
      );
    },
  }),
];

export const autocompleteDropdownMiddleware =
  createAutocompleteDropdownMiddleware();

export const autoUpdateAutocompleteDropdown: NonNullable<
  UseFloatingOptions['whileElementsMounted']
> = (reference, floating, update) =>
  autoUpdate(reference, floating, update, {
    ancestorResize: false,
    layoutShift: false,
  });
