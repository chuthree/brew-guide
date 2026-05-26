'use client';

import { autoUpdate, offset } from '@floating-ui/react';
import type { UseFloatingOptions } from '@floating-ui/react';

export const autocompleteDropdownMiddleware: NonNullable<
  UseFloatingOptions['middleware']
> = [offset(4)];

export const autoUpdateAutocompleteDropdown: NonNullable<
  UseFloatingOptions['whileElementsMounted']
> = (reference, floating, update) =>
  autoUpdate(reference, floating, update, {
    ancestorResize: false,
    layoutShift: false,
  });
