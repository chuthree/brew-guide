'use client';

import React from 'react';

import { SettingsOptions } from './Settings';
import { useSettingsStore } from '@/lib/stores/settingsStore';
import { useModalHistory, modalHistory } from '@/lib/hooks/useModalHistory';
import { showToast } from '@/components/common/feedback/LightToast';
import {
  DEFAULT_BEAN_RECOGNITION_PROMPT,
  testCustomBeanRecognitionConfig,
} from '@/lib/api/beanRecognition';
import {
  SettingPage,
  SettingSection,
  SettingRow,
  SettingToggle,
} from './atomic';

interface ExperimentalSettingsProps {
  settings: SettingsOptions;
  onClose: () => void;
  handleChange: <K extends keyof SettingsOptions>(
    key: K,
    value: SettingsOptions[K]
  ) => void;
}

const ExperimentalSettings: React.FC<ExperimentalSettingsProps> = ({
  settings: _settings,
  onClose,
  handleChange: _handleChange,
}) => {
  // 使用 settingsStore 获取设置
  const settings = useSettingsStore(state => state.settings) as SettingsOptions;
  const updateSettings = useSettingsStore(state => state.updateSettings);

  // 使用 settingsStore 的 handleChange
  const handleChange = React.useCallback(
    async <K extends keyof SettingsOptions>(
      key: K,
      value: SettingsOptions[K]
    ) => {
      await updateSettings({ [key]: value } as any);
    },
    [updateSettings]
  );

  // 控制动画状态
  const [isVisible, setIsVisible] = React.useState(false);
  const [showApiKey, setShowApiKey] = React.useState(false);
  const [isTestingConfig, setIsTestingConfig] = React.useState(false);

  const [apiBaseUrl, setApiBaseUrl] = React.useState(
    settings.experimentalBeanRecognitionApiBaseUrl || ''
  );
  const [apiKey, setApiKey] = React.useState(
    settings.experimentalBeanRecognitionApiKey || ''
  );
  const [model, setModel] = React.useState(
    settings.experimentalBeanRecognitionModel || ''
  );
  const [prompt, setPrompt] = React.useState(
    settings.experimentalBeanRecognitionPrompt || ''
  );

  React.useEffect(() => {
    setApiBaseUrl(settings.experimentalBeanRecognitionApiBaseUrl || '');
    setApiKey(settings.experimentalBeanRecognitionApiKey || '');
    setModel(settings.experimentalBeanRecognitionModel || '');
    setPrompt(settings.experimentalBeanRecognitionPrompt || '');
  }, [
    settings.experimentalBeanRecognitionApiBaseUrl,
    settings.experimentalBeanRecognitionApiKey,
    settings.experimentalBeanRecognitionModel,
    settings.experimentalBeanRecognitionPrompt,
  ]);

  // 用于保存最新的 onClose 引用
  const onCloseRef = React.useRef(onClose);
  onCloseRef.current = onClose;

  // 关闭处理函数（带动画）
  const handleCloseWithAnimation = React.useCallback(() => {
    setIsVisible(false);
    window.dispatchEvent(new CustomEvent('subSettingsClosing'));
    setTimeout(() => {
      onCloseRef.current();
    }, 350);
  }, []);

  // 使用统一的历史栈管理系统
  useModalHistory({
    id: 'experimental-settings',
    isOpen: true,
    onClose: handleCloseWithAnimation,
  });

  // UI 返回按钮点击处理
  const handleClose = () => {
    modalHistory.back();
  };

  // 处理显示/隐藏动画（入场动画）
  React.useEffect(() => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setIsVisible(true);
      });
    });
  }, []);

  const saveApiBaseUrl = async () => {
    const value = apiBaseUrl.trim();
    if (value && !/^https?:\/\//i.test(value)) {
      showToast({
        type: 'error',
        title: '请输入有效的接口地址（需以 http:// 或 https:// 开头）',
      });
      return;
    }
    await handleChange('experimentalBeanRecognitionApiBaseUrl', value);
  };

  const saveApiKey = async () => {
    await handleChange('experimentalBeanRecognitionApiKey', apiKey.trim());
  };

  const saveModel = async () => {
    await handleChange('experimentalBeanRecognitionModel', model.trim());
  };

  const savePrompt = async () => {
    await handleChange('experimentalBeanRecognitionPrompt', prompt.trim());
  };

  const restoreDefaultPrompt = async () => {
    setPrompt(DEFAULT_BEAN_RECOGNITION_PROMPT);
    await handleChange(
      'experimentalBeanRecognitionPrompt',
      DEFAULT_BEAN_RECOGNITION_PROMPT
    );
  };

  const testConfig = async () => {
    try {
      setIsTestingConfig(true);
      const result = await testCustomBeanRecognitionConfig({
        enabled: true,
        apiBaseUrl: apiBaseUrl.trim(),
        apiKey: apiKey.trim(),
        model: model.trim(),
        prompt: prompt.trim() || DEFAULT_BEAN_RECOGNITION_PROMPT,
      });
      showToast({
        type: 'success',
        title: `连接成功（${result.durationMs}ms）`,
      });
    } catch (error) {
      showToast({
        type: 'error',
        title: error instanceof Error ? error.message : '测试失败',
      });
    } finally {
      setIsTestingConfig(false);
    }
  };

  return (
    <SettingPage title="实验功能" isVisible={isVisible} onClose={handleClose}>
      <SettingSection
        title="咖啡豆"
        footer="开启后，手动添加咖啡豆将使用全屏表单。"
      >
        <SettingRow label="沉浸式添加" isLast>
          <SettingToggle
            checked={settings.immersiveAdd || false}
            onChange={checked => handleChange('immersiveAdd', checked)}
          />
        </SettingRow>
      </SettingSection>

      <SettingSection footer="使用你配置的模型服务识别咖啡豆，并确保所选模型具备视觉理解能力，以获得稳定准确的识别结果。">
        <SettingRow label="自定义识别咖啡豆 API">
          <SettingToggle
            checked={settings.experimentalBeanRecognitionEnabled || false}
            onChange={checked =>
              handleChange('experimentalBeanRecognitionEnabled', checked)
            }
          />
        </SettingRow>
        {settings.experimentalBeanRecognitionEnabled && (
          <div className="space-y-2 px-3 py-3">
            <div className="rounded-xl bg-white/80 px-3 py-2 dark:bg-neutral-900/60">
              <p className="mb-1 text-xs text-neutral-500 dark:text-neutral-400">
                API URL
              </p>
              <input
                value={apiBaseUrl}
                onChange={e => setApiBaseUrl(e.target.value)}
                onBlur={saveApiBaseUrl}
                placeholder="https://api.qnaigc.com/v1"
                className="w-full bg-transparent text-sm text-neutral-800 placeholder:text-neutral-400 focus:outline-none dark:text-neutral-100 dark:placeholder:text-neutral-500"
              />
            </div>

            <div className="rounded-xl bg-white/80 px-3 py-2 dark:bg-neutral-900/60">
              <div className="mb-1 flex items-center justify-between">
                <p className="text-xs text-neutral-500 dark:text-neutral-400">
                  API Key
                </p>
                <button
                  onClick={() => setShowApiKey(v => !v)}
                  className="text-xs text-neutral-500 dark:text-neutral-400"
                >
                  {showApiKey ? '隐藏' : '查看'}
                </button>
              </div>
              <input
                value={apiKey}
                type={showApiKey ? 'text' : 'password'}
                onChange={e => setApiKey(e.target.value)}
                onBlur={saveApiKey}
                placeholder="sk-..."
                className="w-full bg-transparent text-sm text-neutral-800 placeholder:text-neutral-400 focus:outline-none dark:text-neutral-100 dark:placeholder:text-neutral-500"
              />
            </div>

            <div className="rounded-xl bg-white/80 px-3 py-2 dark:bg-neutral-900/60">
              <p className="mb-1 text-xs text-neutral-500 dark:text-neutral-400">
                Model
              </p>
              <input
                value={model}
                onChange={e => setModel(e.target.value)}
                onBlur={saveModel}
                placeholder="qwen-vl-max-2025-01-25"
                className="w-full bg-transparent text-sm text-neutral-800 placeholder:text-neutral-400 focus:outline-none dark:text-neutral-100 dark:placeholder:text-neutral-500"
              />
            </div>

            <div className="rounded-xl bg-white/80 px-3 py-2 dark:bg-neutral-900/60">
              <div className="mb-1 flex items-center justify-between">
                <p className="text-xs text-neutral-500 dark:text-neutral-400">
                  System Prompt
                </p>
                <button
                  onClick={restoreDefaultPrompt}
                  className="text-xs text-neutral-500 dark:text-neutral-400"
                >
                  重置
                </button>
              </div>
              <textarea
                value={prompt}
                onChange={e => setPrompt(e.target.value)}
                onBlur={savePrompt}
                placeholder={DEFAULT_BEAN_RECOGNITION_PROMPT}
                className="h-28 w-full resize-none bg-transparent text-sm text-neutral-800 placeholder:text-neutral-400 focus:outline-none dark:text-neutral-100 dark:placeholder:text-neutral-500"
              />
            </div>

            <button
              onClick={testConfig}
              disabled={isTestingConfig}
              className={`w-full rounded-xl px-3 py-2 text-sm font-medium transition-colors ${
                isTestingConfig
                  ? 'bg-neutral-200 text-neutral-500 dark:bg-neutral-700 dark:text-neutral-400'
                  : 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900'
              }`}
            >
              {isTestingConfig ? '测试中...' : '测试连接'}
            </button>
          </div>
        )}
      </SettingSection>
    </SettingPage>
  );
};

export default ExperimentalSettings;
