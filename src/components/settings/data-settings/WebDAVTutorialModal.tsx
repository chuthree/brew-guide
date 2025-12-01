'use client';

import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ActionDrawer from '@/components/common/ui/ActionDrawer';
import { showToast } from '@/components/common/feedback/LightToast';
import { useModalHistory } from '@/lib/hooks/useModalHistory';
import { WebDAVSyncManager } from '@/lib/webdav/syncManager';

// 图标导入
import Download2Icon from '@public/images/icons/ui/download-2.svg';
import DensityMediumIcon from '@public/images/icons/ui/density-medium.svg';
import BottomRightClickIcon from '@public/images/icons/ui/bottom-right-click.svg';
import DataTableIcon from '@public/images/icons/ui/data-table.svg';
import CheerIcon from '@public/images/icons/ui/cheer.svg';

// 步骤类型定义：介绍 -> 下载 -> 注册 -> 填写 -> 完成
type TutorialStep = 'intro' | 'download' | 'register' | 'config' | 'complete';

interface WebDAVTutorialModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: (config: {
    url: string;
    username: string;
    password: string;
  }) => void;
}

// 动画配置 - 与 BeanImportModal 保持一致
const fadeAnimation = {
  initial: { opacity: 0, filter: 'blur(1px)', scale: 0.99 },
  animate: { opacity: 1, filter: 'blur(0px)', scale: 1 },
  exit: { opacity: 0, filter: 'blur(1px)', scale: 0.99 },
  transition: { duration: 0.15 },
};

// 根据步骤获取图标 - 每个步骤使用不同图标
const getStepIcon = (step: TutorialStep) => {
  switch (step) {
    case 'intro':
      return DensityMediumIcon;
    case 'download':
      return Download2Icon;
    case 'register':
      return BottomRightClickIcon;
    case 'config':
      return DataTableIcon;
    case 'complete':
      return CheerIcon;
  }
};

const WebDAVTutorialModal: React.FC<WebDAVTutorialModalProps> = ({
  isOpen,
  onClose,
  onComplete,
}) => {
  // 当前步骤
  const [currentStep, setCurrentStep] = useState<TutorialStep>('intro');
  // 表单数据
  const [formData, setFormData] = useState({
    url: 'https://dav.jianguoyun.com/dav/',
    username: '',
    password: '',
  });
  // 连接测试状态
  const [isConnecting, setIsConnecting] = useState(false);
  // 显示密码
  const [showPassword, setShowPassword] = useState(false);

  // 返回上一步
  const goBack = useCallback(() => {
    if (currentStep === 'complete') {
      setCurrentStep('config');
    } else if (currentStep === 'config') {
      setCurrentStep('register');
    } else if (currentStep === 'register') {
      setCurrentStep('download');
    } else if (currentStep === 'download') {
      setCurrentStep('intro');
    }
  }, [currentStep]);

  // 使用 modalHistory 管理非首步的返回行为
  useModalHistory({
    id: 'webdav-tutorial-step',
    isOpen: isOpen && currentStep !== 'intro',
    onClose: goBack,
  });

  // 重置状态
  const handleClose = useCallback(() => {
    setCurrentStep('intro');
    setFormData({
      url: 'https://dav.jianguoyun.com/dav/',
      username: '',
      password: '',
    });
    setIsConnecting(false);
    onClose();
  }, [onClose]);

  // 进入下一步
  const goToNextStep = useCallback(() => {
    if (currentStep === 'intro') {
      setCurrentStep('download');
    } else if (currentStep === 'download') {
      setCurrentStep('register');
    } else if (currentStep === 'register') {
      setCurrentStep('config');
    } else if (currentStep === 'config') {
      setCurrentStep('complete');
    }
  }, [currentStep]);

  // 测试连接
  const testConnection = useCallback(async () => {
    if (!formData.url || !formData.username || !formData.password) {
      showToast({ type: 'error', title: '请填写完整的配置信息' });
      return;
    }

    setIsConnecting(true);

    try {
      const manager = new WebDAVSyncManager();
      const connected = await manager.initialize({
        url: formData.url,
        username: formData.username,
        password: formData.password,
        remotePath: '',
      });

      if (connected) {
        // 测试成功后直接回调并进入完成步骤
        onComplete({
          url: formData.url,
          username: formData.username,
          password: formData.password,
        });
        goToNextStep();
      } else {
        showToast({ type: 'error', title: '连接失败，请检查配置信息' });
      }
    } catch (error) {
      console.error('WebDAV 连接测试失败:', error);
      showToast({
        type: 'error',
        title: error instanceof Error ? error.message : '连接失败',
      });
    } finally {
      setIsConnecting(false);
    }
  }, [formData, goToNextStep, onComplete]);

  // 当前图标组件
  const CurrentIcon = getStepIcon(currentStep);

  return (
    <ActionDrawer
      isOpen={isOpen}
      onClose={handleClose}
      historyId="webdav-tutorial"
    >
      {/* 图标区域 - 左上角对齐，与 BeanImportModal 一致 */}
      <div className="mb-6 text-neutral-800 dark:text-neutral-200">
        <AnimatePresence mode="popLayout">
          <motion.div key={currentStep} {...fadeAnimation}>
            <CurrentIcon width={128} height={128} />
          </motion.div>
        </AnimatePresence>
      </div>

      {/* 内容区域 */}
      <ActionDrawer.Content>
        <AnimatePresence mode="popLayout">
          {currentStep === 'intro' && (
            <motion.p
              key="intro-content"
              {...fadeAnimation}
              className="text-neutral-500 dark:text-neutral-400"
            >
              只需
              <span className="text-neutral-800 dark:text-neutral-200">
                {' '}
                简单三步
              </span>
              ，即可开启云同步。你的咖啡数据，从此在所有设备上保持一致。
            </motion.p>
          )}

          {currentStep === 'download' && (
            <motion.p
              key="download-content"
              {...fadeAnimation}
              className="text-neutral-500 dark:text-neutral-400"
            >
              前往应用商店下载
              <a
                href="https://www.jianguoyun.com/s/downloads"
                target="_blank"
                rel="noopener noreferrer"
                className="text-neutral-800 underline dark:text-neutral-200"
              >
                {' '}
                坚果云
              </a>
              。这是一款支持 WebDAV 协议的国内云存储服务，稳定可靠。
            </motion.p>
          )}

          {currentStep === 'register' && (
            <motion.div
              key="register-content"
              {...fadeAnimation}
              className="space-y-3"
            >
              <p className="text-neutral-500 dark:text-neutral-400">
                打开坚果云完成
                <span className="text-neutral-800 dark:text-neutral-200">
                  {' '}
                  注册登录
                </span>
                。在
                <span className="text-neutral-800 dark:text-neutral-200">
                  {' '}
                  设置 → 第三方应用管理
                </span>{' '}
                中，添加应用密码，名称填写
                <span className="text-neutral-800 dark:text-neutral-200">
                  {' '}
                  Brew Guide
                </span>
                。
              </p>
            </motion.div>
          )}

          {currentStep === 'config' && (
            <motion.p
              key="config-content"
              {...fadeAnimation}
              className="text-neutral-500 dark:text-neutral-400"
            >
              输入坚果云
              <span className="text-neutral-800 dark:text-neutral-200">
                {' '}
                第三方应用管理
              </span>{' '}
              页面中的账号和应用密码。
            </motion.p>
          )}

          {currentStep === 'complete' && (
            <motion.p
              key="complete-content"
              {...fadeAnimation}
              className="text-neutral-500 dark:text-neutral-400"
            >
              <span className="text-neutral-800 dark:text-neutral-200">
                一切就绪。
              </span>
              云同步已配置完成，你可以随时手动上传或下载咖啡数据。
            </motion.p>
          )}
        </AnimatePresence>
      </ActionDrawer.Content>

      {/* 操作按钮区域 */}
      <div className="flex flex-col gap-2">
        <AnimatePresence mode="popLayout">
          {currentStep === 'intro' && (
            <motion.div
              key="intro-actions"
              {...fadeAnimation}
              className="flex flex-col gap-2"
            >
              <motion.button
                whileTap={{ scale: 0.98 }}
                onClick={goToNextStep}
                className="w-full rounded-full bg-neutral-900 px-4 py-3 text-sm font-medium text-white dark:bg-white dark:text-neutral-900"
              >
                开始配置
              </motion.button>
              <motion.button
                whileTap={{ scale: 0.98 }}
                onClick={handleClose}
                className="w-full rounded-full bg-neutral-100 px-4 py-3 text-sm font-medium text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300"
              >
                稍后再说
              </motion.button>
            </motion.div>
          )}

          {currentStep === 'download' && (
            <motion.div
              key="download-actions"
              {...fadeAnimation}
              className="flex flex-col gap-2"
            >
              <motion.button
                whileTap={{ scale: 0.98 }}
                onClick={goToNextStep}
                className="w-full rounded-full bg-neutral-900 px-4 py-3 text-sm font-medium text-white dark:bg-white dark:text-neutral-900"
              >
                已下载，下一步
              </motion.button>
              <motion.button
                whileTap={{ scale: 0.98 }}
                onClick={goBack}
                className="w-full rounded-full bg-neutral-100 px-4 py-3 text-sm font-medium text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300"
              >
                返回
              </motion.button>
            </motion.div>
          )}

          {currentStep === 'register' && (
            <motion.div
              key="register-actions"
              {...fadeAnimation}
              className="flex flex-col gap-2"
            >
              <motion.button
                whileTap={{ scale: 0.98 }}
                onClick={goToNextStep}
                className="w-full rounded-full bg-neutral-900 px-4 py-3 text-sm font-medium text-white dark:bg-white dark:text-neutral-900"
              >
                已创建应用密码，下一步
              </motion.button>
              <motion.button
                whileTap={{ scale: 0.98 }}
                onClick={goBack}
                className="w-full rounded-full bg-neutral-100 px-4 py-3 text-sm font-medium text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300"
              >
                返回
              </motion.button>
            </motion.div>
          )}

          {currentStep === 'config' && (
            <motion.div
              key="config-actions"
              {...fadeAnimation}
              className="flex flex-col gap-2"
            >
              {/* 配置表单 */}
              <div className="mb-2 space-y-3">
                {/* 服务器地址 */}
                <div>
                  <label className="mb-1 block text-xs font-medium text-neutral-600 dark:text-neutral-400">
                    服务器地址
                  </label>
                  <input
                    type="url"
                    value={formData.url}
                    onChange={e =>
                      setFormData(prev => ({ ...prev, url: e.target.value }))
                    }
                    placeholder="https://dav.jianguoyun.com/dav/"
                    className="w-full rounded-2xl bg-neutral-100 px-4 py-3 text-sm text-neutral-800 placeholder:text-neutral-400 focus:ring-2 focus:ring-neutral-300 focus:outline-none dark:bg-neutral-800 dark:text-white dark:placeholder:text-neutral-500 dark:focus:ring-neutral-600"
                  />
                </div>

                {/* 账号 */}
                <div>
                  <label className="mb-1 block text-xs font-medium text-neutral-600 dark:text-neutral-400">
                    账号
                  </label>
                  <input
                    type="email"
                    value={formData.username}
                    onChange={e =>
                      setFormData(prev => ({
                        ...prev,
                        username: e.target.value,
                      }))
                    }
                    placeholder="坚果云登录邮箱"
                    autoComplete="email"
                    className="w-full rounded-2xl bg-neutral-100 px-4 py-3 text-sm text-neutral-800 placeholder:text-neutral-400 focus:ring-2 focus:ring-neutral-300 focus:outline-none dark:bg-neutral-800 dark:text-white dark:placeholder:text-neutral-500 dark:focus:ring-neutral-600"
                  />
                </div>

                {/* 应用密码 */}
                <div>
                  <label className="mb-1 block text-xs font-medium text-neutral-600 dark:text-neutral-400">
                    应用密码
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={formData.password}
                      onChange={e =>
                        setFormData(prev => ({
                          ...prev,
                          password: e.target.value,
                        }))
                      }
                      placeholder="坚果云应用密码"
                      autoComplete="current-password"
                      className="w-full rounded-2xl bg-neutral-100 px-4 py-3 pr-10 text-sm text-neutral-800 placeholder:text-neutral-400 focus:ring-2 focus:ring-neutral-300 focus:outline-none dark:bg-neutral-800 dark:text-white dark:placeholder:text-neutral-500 dark:focus:ring-neutral-600"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute top-1/2 right-3 -translate-y-1/2 transform p-1 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300"
                    >
                      <svg
                        className="h-4 w-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        {showPassword ? (
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={1.5}
                            d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L8.464 8.464m1.414 1.414L8.464 8.464m5.656 5.656L15.536 15.536m-1.414-1.414L15.536 15.536"
                          />
                        ) : (
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={1.5}
                            d="M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                          />
                        )}
                      </svg>
                    </button>
                  </div>
                </div>
              </div>

              {/* 操作按钮 */}
              <div className="flex gap-2">
                <motion.button
                  whileTap={{ scale: 0.98 }}
                  onClick={goBack}
                  className="flex-1 rounded-full bg-neutral-100 px-4 py-3 text-sm font-medium text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300"
                >
                  上一步
                </motion.button>
                <motion.button
                  whileTap={
                    !formData.username || !formData.password || isConnecting
                      ? undefined
                      : { scale: 0.98 }
                  }
                  onClick={testConnection}
                  disabled={
                    !formData.username || !formData.password || isConnecting
                  }
                  className={`flex-1 rounded-full px-4 py-3 text-sm font-medium transition-colors ${
                    formData.username && formData.password && !isConnecting
                      ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900'
                      : 'bg-neutral-100 text-neutral-400 dark:bg-neutral-800 dark:text-neutral-500'
                  }`}
                >
                  {isConnecting ? '连接中...' : '测试连接'}
                </motion.button>
              </div>
            </motion.div>
          )}

          {currentStep === 'complete' && (
            <motion.div
              key="complete-actions"
              {...fadeAnimation}
              className="flex flex-col gap-2"
            >
              <motion.button
                whileTap={{ scale: 0.98 }}
                onClick={handleClose}
                className="w-full rounded-full bg-neutral-900 px-4 py-3 text-sm font-medium text-white dark:bg-white dark:text-neutral-900"
              >
                完成
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </ActionDrawer>
  );
};

export default WebDAVTutorialModal;
