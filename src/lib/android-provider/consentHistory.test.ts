import { describe, expect, it, vi } from 'vitest';
import { installProviderConsentHistory } from './consentHistory';
import type { ModalEntry } from '@/lib/navigation/modalHistory';

describe('Provider consent Back handling', () => {
  it('keeps the original editor beneath one guard while native resolution is pending', () => {
    const editor = { id: 'unsaved-note', onClose: vi.fn() };
    const stack: ModalEntry[] = [editor];
    const history = {
      register(entry: ModalEntry) {
        if (!stack.some(item => item.id === entry.id)) stack.push(entry);
      },
      close(id: string, _skip?: boolean, expected?: ModalEntry) {
        const index = stack.findIndex(
          item => item.id === id && item === expected
        );
        if (index >= 0) stack.splice(index, 1);
      },
    };
    const cancel = vi.fn();
    const cleanup = installProviderConsentHistory(history, cancel);
    for (let i = 0; i < 3; i++) stack.pop()!.onClose({ source: 'history' });
    expect(stack.map(item => item.id)).toEqual([
      'unsaved-note',
      'provider-authorization',
    ]);
    expect(editor.onClose).not.toHaveBeenCalled();
    expect(cancel).toHaveBeenCalledTimes(3);
    cleanup();
    expect(stack).toEqual([editor]);
  });
});
