'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import AddCircleIcon from '@public/images/icons/ui/add-circle.svg';
import AddBoxIcon from '@public/images/icons/ui/add-box.svg';
import ActionDrawer from '@/components/common/ui/ActionDrawer';
import { showToast } from '@/components/common/feedback/LightToast';
import { useCoffeeBeanStore } from '@/lib/stores/coffeeBeanStore';
import { previewRecognitionBean } from '@/components/preview/demoBeans';

const DEMO_RECOGNITION_DELAY_MS = 2000;

const {
  image: _image,
  backImage: _backImage,
  ...previewBeanWithoutImages
} = previewRecognitionBean;
const previewBeanJson = JSON.stringify(previewBeanWithoutImages, null, 2);

const addPreviewBean = (withImage: boolean) => {
  const bean = withImage ? previewRecognitionBean : previewBeanWithoutImages;
  const store = useCoffeeBeanStore.getState();
  if (store.beans.some(item => item.id === previewRecognitionBean.id)) {
    showToast({ type: 'warning', title: '这款咖啡豆已添加' });
    return false;
  }

  store.setBeans([...store.beans, bean]);
  return true;
};

type ImportStep = 'main' | 'recognizing' | 'json-input';

interface BeanImportModalProps {
  showForm: boolean;
  onClose: () => void;
}

const BeanImportModal: React.FC<BeanImportModalProps> = ({
  showForm,
  onClose,
}) => {
  const [currentStep, setCurrentStep] = useState<ImportStep>('main');
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  const resetAndClose = () => {
    setCurrentStep('main');
    setPreviewImage(null);
    onClose();
  };

  const runRecognition = async (withImage: boolean) => {
    setCurrentStep('recognizing');
    setPreviewImage(withImage ? previewRecognitionBean.image || null : null);

    await new Promise(resolve =>
      setTimeout(resolve, DEMO_RECOGNITION_DELAY_MS)
    );

    addPreviewBean(withImage);
    resetAndClose();
  };

  const mainContent = (
    <>
      <div className="mb-6 text-neutral-800 dark:text-neutral-200">
        <AddCircleIcon width={128} height={128} />
      </div>

      <ActionDrawer.Content>
        <p className="text-neutral-500 dark:text-neutral-400">
          推荐使用
          <span className="text-neutral-800 dark:text-neutral-200">
            图片识别
          </span>
          添加咖啡豆，也可将图片和
          <span className="mx-0.5 text-neutral-800 underline decoration-neutral-400 underline-offset-2 dark:text-neutral-200">
            提示词
          </span>
          发给 AI 生成 JSON 后粘贴导入。
        </p>
      </ActionDrawer.Content>

      <div className="flex flex-col gap-2">
        <motion.button
          whileTap={{ scale: 0.98 }}
          onClick={() => runRecognition(true)}
          className="w-full rounded-full bg-neutral-100 px-4 py-3 text-left text-sm font-medium text-neutral-800 dark:bg-neutral-800 dark:text-white"
        >
          图片识别咖啡豆（推荐）
        </motion.button>
        <motion.button
          whileTap={{ scale: 0.98 }}
          onClick={() => {
            addPreviewBean(false);
            resetAndClose();
          }}
          className="w-full rounded-full bg-neutral-100 px-4 py-3 text-left text-sm font-medium text-neutral-800 dark:bg-neutral-800 dark:text-white"
        >
          识别剪切板
        </motion.button>
        <motion.button
          whileTap={{ scale: 0.98 }}
          onClick={() => setCurrentStep('json-input')}
          className="w-full rounded-full bg-neutral-100 px-4 py-3 text-left text-sm font-medium text-neutral-800 dark:bg-neutral-800 dark:text-white"
        >
          输入 JSON
        </motion.button>
      </div>
    </>
  );

  const recognizingContent = (
    <>
      <div className="mb-6 text-neutral-800 dark:text-neutral-200">
        {previewImage ? (
          <img
            src={previewImage}
            alt="正在识别的咖啡豆"
            className="max-h-[50vh] w-full rounded-3xl object-cover brightness-75"
          />
        ) : (
          <AddCircleIcon width={128} height={128} />
        )}
      </div>

      <ActionDrawer.Content>
        <p className="text-neutral-500 dark:text-neutral-400">
          正在识别咖啡豆信息...
        </p>
      </ActionDrawer.Content>
    </>
  );

  const jsonInputContent = (
    <>
      <div className="mb-6 text-neutral-800 dark:text-neutral-200">
        <AddBoxIcon width={128} height={128} />
      </div>

      <ActionDrawer.Content>
        <p className="text-neutral-500 dark:text-neutral-400">
          确认预设 JSON 后添加咖啡豆。
        </p>
      </ActionDrawer.Content>

      <div className="flex flex-col gap-2">
        <textarea
          readOnly
          value={previewBeanJson}
          className="h-32 w-full resize-none rounded-2xl bg-neutral-100 px-4 py-3 text-sm text-neutral-800 focus:outline-none dark:bg-neutral-800 dark:text-white"
        />
        <div className="flex gap-2">
          <motion.button
            whileTap={{ scale: 0.98 }}
            onClick={() => setCurrentStep('main')}
            className="flex-1 rounded-full bg-neutral-100 px-4 py-3 text-sm font-medium text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300"
          >
            取消
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.98 }}
            onClick={() => {
              addPreviewBean(false);
              resetAndClose();
            }}
            className="flex-1 rounded-full bg-neutral-900 px-4 py-3 text-sm font-medium text-white dark:bg-white dark:text-neutral-900"
          >
            确认导入
          </motion.button>
        </div>
      </div>
    </>
  );

  const content =
    currentStep === 'recognizing'
      ? recognizingContent
      : currentStep === 'json-input'
        ? jsonInputContent
        : mainContent;

  return (
    <ActionDrawer
      isOpen={showForm}
      onClose={resetAndClose}
      historyId="bean-import"
    >
      <ActionDrawer.Switcher activeKey={currentStep}>
        {content}
      </ActionDrawer.Switcher>
    </ActionDrawer>
  );
};

export default BeanImportModal;
