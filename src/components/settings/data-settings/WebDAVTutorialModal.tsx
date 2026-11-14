'use client';

import React, { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { SettingInput, SettingRow } from '../atomic';
import ActionDrawer from '@/components/common/ui/ActionDrawer';
import { showToast } from '@/components/common/feedback/LightToast';
import { showErrorReport } from '@/lib/feedback/errorReport';
import { useModalHistory } from '@/lib/hooks/useModalHistory';
import { WebDAVSyncManager } from '@/lib/webdav/syncManager';
import { CloudProxySetting } from './shared/CloudProxySetting';
import { handleExternalUrlClick } from '@/lib/utils/openExternalUrl';

// 图标导入
import Download2Icon from '@public/images/icons/ui/download-2.svg';
import DensityMediumIcon from '@public/images/icons/ui/density-medium.svg';
import BottomRightClickIcon from '@public/images/icons/ui/bottom-right-click.svg';
import DataTableIcon from '@public/images/icons/ui/data-table.svg';
import CheerIcon from '@public/images/icons/ui/cheer.svg';

// 步骤类型定义：介绍 -> 下载 -> 注册 -> 填写 -> 完成
type TutorialStep = 'intro' | 'download' | 'register' | 'config' | 'complete';

interface WebDAVTutorialModalProps {
  proxyUrl?: string;
  onProxyChange: (value: string) => void;
  isOpen: boolean;
  onClose: () => void;
  onComplete: (config: {
    url: string;
    username: string;
    password: string;
  }) => void;
}

const WebDAVTutorialModal: React.FC<WebDAVTutorialModalProps> = ({
  isOpen,
  onClose,
  onComplete,
  proxyUrl,
  onProxyChange,
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
        proxyUrl,
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
        showErrorReport({
          title: 'WebDAV 连接失败',
          source: 'webdav:tutorial-connect',
          error: manager.getLastError(),
        });
      }
    } catch (error) {
      showErrorReport({
        title: 'WebDAV 连接失败',
        source: 'webdav:tutorial-connect',
        error,
      });
    } finally {
      setIsConnecting(false);
    }
  }, [formData, proxyUrl, goToNextStep, onComplete]);

  // 介绍步骤内容
  const introContent = (
    <>
      <div className="mb-6 text-neutral-800 dark:text-neutral-200">
        <DensityMediumIcon width={128} height={128} />
      </div>
      <ActionDrawer.Content>
        <p className="text-neutral-500 dark:text-neutral-400">
          只需
          <span className="text-neutral-800 dark:text-neutral-200">
            {' '}
            简单三步
          </span>
          ，即可开启云同步。你的咖啡数据，从此在所有设备上保持一致。
        </p>
      </ActionDrawer.Content>
      <div className="flex flex-col gap-2">
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
      </div>
    </>
  );

  // 下载步骤内容
  const downloadContent = (
    <>
      <div className="mb-6 text-neutral-800 dark:text-neutral-200">
        <Download2Icon width={128} height={128} />
      </div>
      <ActionDrawer.Content>
        <p className="text-neutral-500 dark:text-neutral-400">
          前往应用商店下载
          <a
            href="https://www.jianguoyun.com/s/downloads"
            target="_blank"
            rel="noopener noreferrer"
            onClick={handleExternalUrlClick}
            className="text-neutral-800 underline dark:text-neutral-200"
          >
            {' '}
            坚果云
          </a>
          。这是一款支持 WebDAV 协议的国内云存储服务，稳定可靠。
        </p>
      </ActionDrawer.Content>
      <div className="flex flex-col gap-2">
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
      </div>
    </>
  );

  // 注册步骤内容
  const registerContent = (
    <>
      <div className="mb-6 text-neutral-800 dark:text-neutral-200">
        <BottomRightClickIcon width={128} height={128} />
      </div>
      <ActionDrawer.Content>
        <div className="space-y-3">
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
        </div>
      </ActionDrawer.Content>
      <div className="flex flex-col gap-2">
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
      </div>
    </>
  );

  // 配置步骤内容
  const configContent = (
    <>
      <div className="mb-6 text-neutral-800 dark:text-neutral-200">
        <DataTableIcon width={128} height={128} />
      </div>
      <ActionDrawer.Content>
        <p className="text-neutral-500 dark:text-neutral-400">
          输入坚果云
          <span className="text-neutral-800 dark:text-neutral-200">
            {' '}
            第三方应用管理
          </span>{' '}
          页面中的账号和应用密码。
        </p>
      </ActionDrawer.Content>
      <div className="flex flex-col gap-2">
        {/* 配置表单 */}
        <div className="mb-2 overflow-hidden rounded-xl bg-neutral-100 dark:bg-neutral-800/40">
          <CloudProxySetting value={proxyUrl} onChange={onProxyChange} />

          {/* 服务器地址 */}
          <SettingRow label="服务器地址" expandControl>
            <SettingInput
              aria-label="服务器地址"
              type="url"
              value={formData.url}
              onChange={e =>
                setFormData(prev => ({ ...prev, url: e.target.value }))
              }
              placeholder="服务器地址"
            />
          </SettingRow>

          {/* 账号 */}
          <SettingRow label="账号" expandControl>
            <SettingInput
              aria-label="账号"
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
            />
          </SettingRow>

          {/* 应用密码 */}
          <SettingRow label="应用密码" expandControl isLast>
            <SettingInput
              aria-label="应用密码"
              type="password"
              value={formData.password}
              onChange={e =>
                setFormData(prev => ({
                  ...prev,
                  password: e.target.value,
                }))
              }
              placeholder="坚果云应用密码"
              autoComplete="current-password"
            />
          </SettingRow>
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
            disabled={!formData.username || !formData.password || isConnecting}
            className={`flex-1 rounded-full px-4 py-3 text-sm font-medium transition-colors ${
              formData.username && formData.password && !isConnecting
                ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900'
                : 'bg-neutral-100 text-neutral-400 dark:bg-neutral-800 dark:text-neutral-500'
            }`}
          >
            {isConnecting ? '连接中...' : '测试连接'}
          </motion.button>
        </div>
      </div>
    </>
  );

  // 完成步骤内容
  const completeContent = (
    <>
      <div className="mb-6 text-neutral-800 dark:text-neutral-200">
        <CheerIcon width={128} height={128} />
      </div>
      <ActionDrawer.Content>
        <p className="text-neutral-500 dark:text-neutral-400">
          <span className="text-neutral-800 dark:text-neutral-200">
            一切就绪。
          </span>
          云同步已配置完成，你可以随时手动上传或下载咖啡数据。
        </p>
      </ActionDrawer.Content>
      <div className="flex flex-col gap-2">
        <motion.button
          whileTap={{ scale: 0.98 }}
          onClick={handleClose}
          className="w-full rounded-full bg-neutral-900 px-4 py-3 text-sm font-medium text-white dark:bg-white dark:text-neutral-900"
        >
          完成
        </motion.button>
      </div>
    </>
  );

  // 根据当前步骤获取内容
  const getStepContent = () => {
    switch (currentStep) {
      case 'intro':
        return introContent;
      case 'download':
        return downloadContent;
      case 'register':
        return registerContent;
      case 'config':
        return configContent;
      case 'complete':
        return completeContent;
    }
  };

  return (
    <ActionDrawer
      isOpen={isOpen}
      onClose={handleClose}
      historyId="webdav-tutorial"
    >
      <ActionDrawer.Switcher activeKey={currentStep}>
        {getStepContent()}
      </ActionDrawer.Switcher>
    </ActionDrawer>
  );
};

export default WebDAVTutorialModal;
