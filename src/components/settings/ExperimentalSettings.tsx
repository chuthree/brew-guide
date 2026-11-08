'use client';

import React from 'react';

import { SettingsOptions } from './Settings';
import { useSettingsStore } from '@/lib/stores/settingsStore';
import { useModalHistory, modalHistory } from '@/lib/hooks/useModalHistory';
import { showToast } from '@/components/common/feedback/LightToast';
import { deriveNavigationSettings } from '@/lib/navigation/navigationSettings';
import {
  DEFAULT_BEAN_RECOGNITION_API_BASE_URL,
  DEFAULT_BEAN_RECOGNITION_MODEL,
  DEFAULT_BEAN_RECOGNITION_PROMPT,
  resolveBeanRecognitionModel,
  testCustomBeanRecognitionConfig,
} from '@/lib/api/beanRecognition';
import {
  SettingPage,
  SettingSection,
  SettingRow,
  SettingInput,
  SettingToggle,
  useScrollToHighlightedSetting,
} from './atomic';
import { McpSettingsSection } from './McpSettingsSection';
import BeanSummaryCapacityLimitSection from './BeanSummaryCapacityLimitSection';
import { makeSettingRowSearchId } from './settingsSearch';
import { handleExternalUrlClick } from '@/lib/utils/openExternalUrl';

interface ExperimentalSettingsProps {
  onClose: () => void;
}

const ExperimentalSettings: React.FC<ExperimentalSettingsProps> = ({
  onClose,
}) => {
  // 使用 settingsStore 获取设置
  const settings = useSettingsStore(state => state.settings) as SettingsOptions;
  const navigationState = deriveNavigationSettings(settings.navigationSettings);
  const showCoffeeBeanExperiments = navigationState.visibleTabs.coffeeBean;
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
  const [isTestingConfig, setIsTestingConfig] = React.useState(false);

  const [apiBaseUrl, setApiBaseUrl] = React.useState(
    settings.experimentalBeanRecognitionApiBaseUrl ||
      DEFAULT_BEAN_RECOGNITION_API_BASE_URL
  );
  const [apiKey, setApiKey] = React.useState(
    settings.experimentalBeanRecognitionApiKey || ''
  );
  const [model, setModel] = React.useState(
    resolveBeanRecognitionModel(settings.experimentalBeanRecognitionModel)
  );
  const [prompt, setPrompt] = React.useState(
    settings.experimentalBeanRecognitionPrompt ||
      DEFAULT_BEAN_RECOGNITION_PROMPT
  );

  React.useEffect(() => {
    setApiBaseUrl(
      settings.experimentalBeanRecognitionApiBaseUrl ||
        DEFAULT_BEAN_RECOGNITION_API_BASE_URL
    );
    setApiKey(settings.experimentalBeanRecognitionApiKey || '');
    setModel(
      resolveBeanRecognitionModel(settings.experimentalBeanRecognitionModel)
    );
    setPrompt(
      settings.experimentalBeanRecognitionPrompt ||
        DEFAULT_BEAN_RECOGNITION_PROMPT
    );
  }, [
    settings.experimentalBeanRecognitionApiBaseUrl,
    settings.experimentalBeanRecognitionApiKey,
    settings.experimentalBeanRecognitionModel,
    settings.experimentalBeanRecognitionPrompt,
  ]);

  // 用于保存最新的 onClose 引用
  const onCloseRef = React.useRef(onClose);

  React.useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

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
    skipPageExitTransitionOnHistory: true,
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
    const value = resolveBeanRecognitionModel(model);
    setModel(value);
    await handleChange('experimentalBeanRecognitionModel', value);
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
        model: resolveBeanRecognitionModel(model),
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

  useScrollToHighlightedSetting(
    `${settings.experimentalBeanRecognitionEnabled}:${settings.experimentalBeanSharePackageEnabled}:${isTestingConfig}`
  );

  return (
    <SettingPage title="实验性功能" isVisible={isVisible} onClose={handleClose}>
      <McpSettingsSection />

      {showCoffeeBeanExperiments && (
        <>
          <BeanSummaryCapacityLimitSection
            settings={settings}
            handleChange={handleChange}
          />

          <SettingSection footer="开启后，分享咖啡豆会生成包含图片的压缩包；添加咖啡豆时也会显示选择压缩包入口。">
            <SettingRow label="分享导入压缩包" isLast>
              <SettingToggle
                checked={settings.experimentalBeanSharePackageEnabled || false}
                onChange={checked =>
                  handleChange('experimentalBeanSharePackageEnabled', checked)
                }
              />
            </SettingRow>
          </SettingSection>
        </>
      )}

      {showCoffeeBeanExperiments && (
        <SettingSection
          footer={
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              使用你自己的模型API用于识别咖啡豆，以获得更准确的结果。
              <a
                className="ml-1 text-neutral-600 underline underline-offset-2 dark:text-neutral-300"
                href="https://chu3.top/brewguide-help/custom-bean-recognition-api"
                target="_blank"
                rel="noreferrer"
                onClick={handleExternalUrlClick}
              >
                查看教程
              </a>
            </p>
          }
        >
          <SettingRow
            label="自定义识别咖啡豆 API"
            isLast={!settings.experimentalBeanRecognitionEnabled}
          >
            <SettingToggle
              checked={settings.experimentalBeanRecognitionEnabled || false}
              onChange={checked =>
                handleChange('experimentalBeanRecognitionEnabled', checked)
              }
              ariaLabel="自定义识别咖啡豆 API"
            />
          </SettingRow>
          {settings.experimentalBeanRecognitionEnabled && (
            <>
              <SettingRow label="API URL" isSubSetting expandControl>
                <SettingInput
                  aria-label="API URL"
                  autoCapitalize="none"
                  spellCheck={false}
                  type="url"
                  value={apiBaseUrl}
                  onChange={e => setApiBaseUrl(e.target.value)}
                  onBlur={saveApiBaseUrl}
                  placeholder={DEFAULT_BEAN_RECOGNITION_API_BASE_URL}
                />
              </SettingRow>

              <SettingRow label="API Key" isSubSetting expandControl>
                <SettingInput
                  aria-label="API Key"
                  autoCapitalize="none"
                  autoComplete="off"
                  spellCheck={false}
                  type="password"
                  value={apiKey}
                  onChange={e => setApiKey(e.target.value)}
                  onBlur={saveApiKey}
                  placeholder="sk-..."
                />
              </SettingRow>

              <SettingRow label="Model" isSubSetting expandControl>
                <SettingInput
                  aria-label="Model"
                  autoCapitalize="none"
                  spellCheck={false}
                  value={model}
                  onChange={e => setModel(e.target.value)}
                  onBlur={saveModel}
                  placeholder={DEFAULT_BEAN_RECOGNITION_MODEL}
                />
              </SettingRow>

              <SettingRow
                settingId={makeSettingRowSearchId('System Prompt')}
                vertical
              >
                <div className="mb-3 flex items-center justify-between gap-3">
                  <label
                    htmlFor="bean-recognition-prompt"
                    className="flex items-center text-sm leading-none font-medium text-neutral-800 dark:text-neutral-200"
                  >
                    <span
                      aria-hidden="true"
                      className="mr-1.5 inline-block text-neutral-500 opacity-50 dark:text-neutral-400"
                    >
                      —
                    </span>
                    System Prompt
                  </label>
                  <button
                    type="button"
                    onClick={restoreDefaultPrompt}
                    className="min-h-6 px-1 text-sm text-neutral-500 active:opacity-70 dark:text-neutral-400"
                  >
                    重置
                  </button>
                </div>
                <textarea
                  id="bean-recognition-prompt"
                  data-vaul-no-drag
                  onPointerDown={event => event.stopPropagation()}
                  value={prompt}
                  onChange={e => setPrompt(e.target.value)}
                  onBlur={savePrompt}
                  placeholder={DEFAULT_BEAN_RECOGNITION_PROMPT}
                  className="h-28 w-full resize-none rounded-md border-0 bg-neutral-50 p-3 text-sm leading-relaxed text-neutral-700 select-text placeholder:text-neutral-400 focus:ring-1 focus:ring-neutral-500 focus:outline-none dark:bg-neutral-800 dark:text-neutral-300 dark:placeholder:text-neutral-500"
                />
              </SettingRow>

              <SettingRow
                label={isTestingConfig ? '测试中...' : '测试连接'}
                settingId={makeSettingRowSearchId('测试连接')}
                isSubSetting
                className="min-h-11"
                onClick={testConfig}
                disabled={isTestingConfig}
                isLast
              >
                {null}
              </SettingRow>
            </>
          )}
        </SettingSection>
      )}
    </SettingPage>
  );
};

export default ExperimentalSettings;
