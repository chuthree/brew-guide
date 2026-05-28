import React, { useEffect, useMemo, useRef, useState } from 'react';
import { CustomEquipment, Method } from '@/lib/core/config';
import CustomEquipmentForm, {
  CustomEquipmentFormHandle,
  EquipmentFormDrawerChrome,
} from './CustomEquipmentForm';
import { exportEquipment, copyToClipboard } from '@/lib/utils/exportUtils';
import PageStackDrawer, {
  useDrawerPageStack,
} from '@/components/common/ui/PageStackDrawer';
import { modalHistory } from '@/lib/navigation/modalHistory';

interface CustomEquipmentFormModalProps {
  showForm: boolean;
  onClose: () => void;
  onSave: (equipment: CustomEquipment, methods?: Method[]) => void;
  editingEquipment?: CustomEquipment;
  onImport?: () => void;
  /** 从导入文件回填的数据 */
  pendingImportData?: {
    equipment: CustomEquipment;
    methods?: Method[];
  } | null;
  /** 清除待回填数据的回调 */
  onClearPendingImport?: () => void;
}

const CustomEquipmentFormModal: React.FC<CustomEquipmentFormModalProps> = ({
  showForm,
  onClose,
  onSave,
  editingEquipment,
  onImport,
  pendingImportData,
  onClearPendingImport,
}) => {
  const formRef = useRef<CustomEquipmentFormHandle>(null);
  const [drawerChrome, setDrawerChrome] = useState<EquipmentFormDrawerChrome>({
    title: editingEquipment ? '编辑器具' : '添加器具',
    doneDisabled: false,
    canGoBack: false,
  });
  // 用于回填的器具数据（来自导入或编辑）
  const [currentEquipment, setCurrentEquipment] = useState<
    CustomEquipment | undefined
  >(editingEquipment);
  // 待保存的方案数据（来自导入）
  const [pendingMethods, setPendingMethods] = useState<Method[] | undefined>(
    undefined
  );

  const pageStack = useDrawerPageStack<'form' | 'equipment-picker'>(
    'form',
    showForm,
    'equipment-form',
    onClose
  );

  // 处理导入数据回填
  useEffect(() => {
    if (pendingImportData && showForm) {
      setCurrentEquipment(pendingImportData.equipment);
      setPendingMethods(pendingImportData.methods);
      onClearPendingImport?.();
    }
  }, [pendingImportData, showForm, onClearPendingImport]);

  // 当 editingEquipment 变化时同步
  useEffect(() => {
    if (editingEquipment) {
      setCurrentEquipment(editingEquipment);
      setPendingMethods(undefined);
    }
  }, [editingEquipment]);

  // 当模态框关闭时重置状态
  useEffect(() => {
    if (!showForm) {
      setCurrentEquipment(undefined);
      setPendingMethods(undefined);
      setDrawerChrome({
        title: editingEquipment ? '编辑器具' : '添加器具',
        doneDisabled: false,
        canGoBack: false,
      });
    }
  }, [editingEquipment, showForm]);

  // 处理关闭 - 使用统一历史栈
  const handleClose = () => {
    modalHistory.back();
  };

  const isEquipmentPickerPage = pageStack.currentPage === 'equipment-picker';

  const headerTitle = useMemo(() => {
    if (isEquipmentPickerPage) return '选择器具';
    return drawerChrome.title;
  }, [drawerChrome.title, isEquipmentPickerPage]);

  const canGoBack = isEquipmentPickerPage || Boolean(drawerChrome.canGoBack);

  const doneDisabled = isEquipmentPickerPage
    ? false
    : Boolean(drawerChrome.doneDisabled);

  const handleBack = () => {
    if (isEquipmentPickerPage) {
      pageStack.back();
      return;
    }

    formRef.current?.back();
  };

  const handleDone = () => {
    if (isEquipmentPickerPage) {
      pageStack.back();
      return;
    }

    formRef.current?.done();
  };

  const _handleExport = async (equipment: CustomEquipment) => {
    try {
      const exportData = exportEquipment(equipment);
      const success = await copyToClipboard(exportData);
      if (success) {
        alert('器具数据已复制到剪贴板');
      } else {
        alert('复制失败，请重试');
      }
    } catch (_error) {
      alert('导出失败，请重试');
    }
  };

  return (
    <PageStackDrawer
      isOpen={showForm}
      title={headerTitle}
      activeKey={`${pageStack.currentPage}-${drawerChrome.key || 'form'}`}
      canGoBack={canGoBack}
      doneDisabled={doneDisabled}
      onCancel={handleClose}
      onBack={handleBack}
      onDone={handleDone}
      historyId="equipment-form"
    >
      {showForm && (
        <CustomEquipmentForm
          ref={formRef}
          key={`equipment-form-${currentEquipment?.id || 'new'}-${pendingImportData ? 'imported' : 'manual'}`}
          activeDrawerPage={pageStack.currentPage}
          onOpenEquipmentPicker={() => pageStack.push('equipment-picker')}
          onChromeChange={setDrawerChrome}
          onImport={currentEquipment ? undefined : onImport}
          onSave={equipment => {
            // 保存时传递待保存的方案
            onSave(equipment, pendingMethods);
            onClose();
          }}
          onCancel={handleClose}
          initialEquipment={currentEquipment}
        />
      )}
    </PageStackDrawer>
  );
};

export default CustomEquipmentFormModal;
