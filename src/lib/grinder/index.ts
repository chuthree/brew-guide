// 重新导出 store 的功能
export {
  useGrinderStore,
  parseGrinderFromGrindSize,
  syncGrinderScale,
  type Grinder,
} from '@/lib/stores/grinderStore';

// 为向后兼容保留旧的命名
export { syncGrinderScale as syncGrinderToSettings } from '@/lib/stores/grinderStore';
