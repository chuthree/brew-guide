'use client';

import ConfirmDrawer from '@/components/common/ui/ConfirmDrawer';
import { useOverwriteConfirmation } from '@/lib/data/overwriteBackup';

export default function OverwriteConfirmation() {
  const pending = useOverwriteConfirmation(state => state.pending);
  if (!pending) return null;
  return (
    <ConfirmDrawer
      isOpen
      isDanger
      title="覆盖本机数据？"
      confirmText={pending.older ? '仍要覆盖' : '覆盖本机数据'}
      onConfirm={pending.confirm}
      onClose={pending.cancel}
      message={
        pending.older
          ? '这份备份比本机数据旧，不建议覆盖。本机较新的记录可能丢失。'
          : '恢复会覆盖本机对应的数据，备份中没有的记录可能被移除。'
      }
    />
  );
}
