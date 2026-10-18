import { expect, it, vi } from 'vitest';
import type { RoasterSettings } from '@/lib/utils/beanVarietyUtils';
import type { CoffeeBean } from '@/types/app';
import type { EditableContent } from './types';
import { useEditableContent } from './hooks';

// 在 Node 环境保留 hook 状态，模拟同步导致的重新渲染并执行 effect。
const hooks = vi.hoisted(() => ({
  content: undefined as EditableContent | undefined,
  ref: { current: undefined as string | null | undefined },
  effect: () => {},
}));

vi.mock('react', () => ({
  useState: (initial: () => EditableContent) => {
    hooks.content ??= initial();
    return [
      hooks.content,
      (
        update:
          | EditableContent
          | ((previous: EditableContent) => EditableContent)
      ) => {
        hooks.content =
          typeof update === 'function' ? update(hooks.content!) : update;
      },
    ];
  },
  useRef: () => hooks.ref,
  useEffect: (effect: () => void) => {
    hooks.effect = effect;
  },
  useCallback: (callback: unknown) => callback,
}));

it('preserves print edits across sync and initializes only for a new editing session', () => {
  let bean: CoffeeBean | null = {
    id: 'bean-1',
    timestamp: 1,
    name: '原始名称',
    notes: '原始备注',
    flavor: ['柑橘'],
  };
  let settings: RoasterSettings = {
    roasterFieldEnabled: false,
    roasterSeparator: ' ',
  };
  const Render = (isOpen = true) => {
    const result = useEditableContent(bean, settings, isOpen);
    hooks.effect();
    return result;
  };

  Render(false);
  const editor = Render();
  editor.updateField('name', '打印专用名称');
  editor.updateField('notes', '打印专用备注');
  editor.updateFlavorItem(0, '桃子');
  const draft = hooks.content;

  bean = { ...bean, name: '同步后的名称', notes: '同步后的备注' };
  settings = { roasterFieldEnabled: true, roasterSeparator: '/' };
  Render();
  expect(hooks.content).toBe(draft);
  expect(hooks.content).toMatchObject({
    name: '打印专用名称',
    notes: '打印专用备注',
    flavor: ['桃子'],
  });

  // 主动重置仍读取最新数据。
  Render().resetContent();
  expect(hooks.content?.name).toBe('同步后的名称');

  Render().updateField('name', '再次编辑');
  Render(false);
  bean = { ...bean, name: '关闭期间更新' };
  Render(false);
  Render();
  expect(hooks.content?.name).toBe('关闭期间更新');

  Render().updateField('name', '第一包豆的编辑');
  bean = { ...bean, id: 'bean-2', name: '另一包豆' };
  Render();
  expect(hooks.content?.name).toBe('另一包豆');

  bean = null;
  Render();
  expect(hooks.content?.name).toBe('');
  bean = { id: 'bean-3', timestamp: 3, name: '加载完成的豆子' };
  Render();
  expect(hooks.content?.name).toBe('加载完成的豆子');
});
