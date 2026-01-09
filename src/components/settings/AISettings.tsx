'use client';

import React, { useState, useEffect } from 'react';
import { useSettingsStore } from '@/lib/stores/settingsStore';
import { db, ProviderConfig, ModelInfo, AppSettings } from '@/lib/core/db';
import { DEFAULT_PROMPTS } from '@/lib/services/ai';
import {
  SettingPage,
  SettingSection,
  SettingRow,
  SettingInput,
} from './atomic';
import {
  Plus,
  Trash2,
  Check,
  ChevronRight,
  Bot,
  Settings as SettingsIcon,
  RefreshCw,

  Loader2,
  Play,
  ChevronDown,
  ChevronUp,
  Search,
  X,
} from 'lucide-react';
import * as Popover from '@radix-ui/react-popover';
import { useModalHistory, modalHistory } from '@/lib/hooks/useModalHistory';

interface AISettingsProps {
  isVisible: boolean;
  onClose: () => void;
}

const DEFAULT_MODELS: ModelInfo[] = [
  {
    modelId: 'qwen-turbo',
    nickname: '通义千问-Turbo',
    type: 'chat',
  },
  {
    modelId: 'qwen-plus',
    nickname: '通义千问-Plus',
    type: 'chat',
  },
  {
    modelId: 'qwen-max',
    nickname: '通义千问-Max',
    type: 'chat',
  },
  {
    modelId: 'deepseek-v3',
    nickname: 'DeepSeek V3',
    type: 'chat',
  },
  {
    modelId: 'deepseek-r1',
    nickname: 'DeepSeek R1',
    type: 'chat',
    capabilities: ['reasoning'],
  },
];

const AISettings: React.FC<AISettingsProps> = ({ isVisible, onClose }) => {
  const settings = useSettingsStore(state => state.settings);
  const addAIProvider = useSettingsStore(state => state.addAIProvider);
  const updateAIProvider = useSettingsStore(state => state.updateAIProvider);
  const removeAIProvider = useSettingsStore(state => state.removeAIProvider);
  const setActiveAIProvider = useSettingsStore(
    state => state.setActiveAIProvider
  );
  const updateSettings = useSettingsStore(state => state.updateSettings);

  const [editingProviderId, setEditingProviderId] = useState<string | null>(
    null
  );
  const [loadingModels, setLoadingModels] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [testResults, setTestResults] = useState<{
    text: 'idle' | 'loading' | 'success' | 'error';
    vision: 'idle' | 'loading' | 'success' | 'error';
    tools: 'idle' | 'loading' | 'success' | 'error';
    toolMessage?: string;
  }>({ text: 'idle', vision: 'idle', tools: 'idle' });
  const [showAdvancedModelSettings, setShowAdvancedModelSettings] = useState(false);
  const [modelSelectorOpen, setModelSelectorOpen] = useState(false);
  const [modelSearchQuery, setModelSearchQuery] = useState('');
  
  // Prompt Editing State
  const [editingPromptKey, setEditingPromptKey] = useState<string | null>(null);
  const [tempPrompt, setTempPrompt] = useState('');
  const [defaultPrompts] = useState<Record<string, string>>(DEFAULT_PROMPTS);


  // Form state
  const [formData, setFormData] = useState<Partial<ProviderConfig>>({});

  // 历史栈管理
  useModalHistory({
    id: 'ai-settings',
    isOpen: isVisible,
    onClose,
  });

  const providers = settings.aiSettings?.providers || [];
  const activeProviderId = settings.aiSettings?.activeProviderId;

  const handleCreateNew = () => {
    const newId = `custom_${Date.now()}`;
    setFormData({
      id: newId,
      name: '自定义 AI',
      type: 'openai',
      iconUrl: '',
      urls: {
        website: '',
      },
      settings: {
        apiHost: 'https://api.openai.com',
        apiKey: '',
        models: [...DEFAULT_MODELS],
      },
    });
    setEditingProviderId(newId);
  };

  const handleEdit = (provider: ProviderConfig) => {
    setFormData(JSON.parse(JSON.stringify(provider)));
    setEditingProviderId(provider.id);
  };

  const handleTypeChange = (type: ProviderConfig['type']) => {
    let defaultHost = '';
    switch (type) {
      case 'openai':
        defaultHost = 'https://api.openai.com';
        break;
      case 'anthropic':
        defaultHost = 'https://api.anthropic.com';
        break;
      case 'gemini':
        defaultHost = 'https://generativelanguage.googleapis.com';
        break;
    }
    
    setFormData({
      ...formData,
      type,
      settings: {
        ...formData.settings!,
        apiHost: defaultHost,
      }
    });
  };

  const handleSave = async () => {
    if (!formData.id || !formData.name) return;

    if (providers.some(p => p.id === formData.id)) {
      await updateAIProvider(formData.id, formData as ProviderConfig);
    } else {
      await addAIProvider(formData as ProviderConfig);
    }
    setEditingProviderId(null);
    setFormData({});
  };

  const handleDelete = async (id: string) => {
    await removeAIProvider(id);
    if (editingProviderId === id) {
      setEditingProviderId(null);
      setFormData({});
    }
  };

  const handleFetchModels = async () => {
    if (!formData.settings?.apiHost || !formData.settings?.apiKey) return;
    
    setLoadingModels(true);
    try {
      const response = await fetch('/api/ai/models', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiHost: formData.settings.apiHost,
          apiKey: formData.settings.apiKey,
          type: formData.type || 'openai',
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch models');
      }

      const { models } = await response.json();
      if (models && models.length > 0) {
        setFormData({
          ...formData,
          settings: {
            ...formData.settings!,
            models,
          },
        });
      }
    } catch (error) {
      console.error('Fetch models error:', error);
      // You might want to show a toast here
    } finally {
      setLoadingModels(false);
    }
  };

  const handleTestConnection = async () => {
     if (!formData.settings?.apiHost || !formData.settings?.apiKey) return;

      setTestingConnection(true);
      setTestResults({ text: 'loading', vision: 'loading', tools: 'loading' });
      
      try {
        const payloadBase = {
          apiHost: formData.settings?.apiHost,
          apiKey: formData.settings?.apiKey,
          type: formData.type || 'openai',
          model: formData.settings?.models?.[0]?.modelId || ''
        };

        const runTest = async (type: 'text' | 'vision' | 'tools') => {
          try {
            const res = await fetch('/api/ai/test', {
              method: 'POST',
              body: JSON.stringify({ ...payloadBase, testType: type })
            });
            if (!res.ok) throw new Error('Failed');
            const data = await res.json();
            if (type === 'tools' && !data.hasToolCall) {
                return { status: 'error' as const, msg: 'No tool call' };
            }
            return { status: 'success' as const };
          } catch (e) {
            return { status: 'error' as const };
          }
        };

        const [textRes, visionRes, toolsRes] = await Promise.all([
          runTest('text'),
          runTest('vision'),
          runTest('tools')
        ]);

        setTestResults({
          text: textRes.status,
          vision: visionRes.status,
          tools: toolsRes.status,
          toolMessage: toolsRes.msg
        });

        // Update overall connection status based on text result
        if (textRes.status === 'success') {
          setConnectionStatus('success');
          setTimeout(() => setConnectionStatus('idle'), 3000);
        } else {
          setConnectionStatus('error');
          setTimeout(() => setConnectionStatus('idle'), 3000);
        }
      } catch (error) {
         console.error(error);
         setTestResults({ text: 'error', vision: 'error', tools: 'error' });
         setConnectionStatus('error');
         setTimeout(() => setConnectionStatus('idle'), 3000);
      } finally {
        setTestingConnection(false);
      }
    };

  // State for prompt editing
  // Fetch default prompts on mount


  const handleEditPrompt = (featureKey: string) => {
    const featureBinding = settings.aiSettings?.featureBindings?.[featureKey as keyof typeof settings.aiSettings.featureBindings];
    setEditingPromptKey(featureKey);
    // Use existing custom prompt OR default prompt as starting value
    // If no custom prompt, pre-fill with default prompt so user can edit based on it
    setTempPrompt(featureBinding?.prompt || defaultPrompts[featureKey] || '');
  };

  const savePrompt = () => {
    if (editingPromptKey && settings.aiSettings) {
      const featureBindings = settings.aiSettings.featureBindings || {};
      const key = editingPromptKey as keyof typeof featureBindings;
      const currentBinding = featureBindings[key] || {};
      
      const newBindings = {
        ...featureBindings,
        [key]: {
          ...currentBinding,
          prompt: tempPrompt.trim() || undefined
        }
      };

      updateSettings({
        aiSettings: {
          ...settings.aiSettings,
          featureBindings: newBindings
        }
      });
      setEditingPromptKey(null);
    }
  };

  const handleAddCustomModel = () => {
    const newModel: ModelInfo = {
      modelId: 'custom-model',
      nickname: 'Custom Model',
      type: 'chat',
      contextWindow: 4096,
      maxOutput: 2048
    };
    
    const currentModels = formData.settings?.models || [];
    setFormData({
      ...formData,
      settings: {
        ...formData.settings!,
        models: [newModel, ...currentModels]
      }
    });
    // Open advanced settings to let user edit it immediately
    setShowAdvancedModelSettings(true);
  };

  const isEditing = !!editingProviderId;

  if (isEditing) {
    return (
      <SettingPage
        title="编辑 AI 服务"
        isVisible={isVisible}
        onClose={() => setEditingProviderId(null)}
      >
        <SettingSection title="基本信息">
          <SettingRow label="名称">
            <SettingInput
              value={formData.name || ''}
              onChange={val => setFormData({ ...formData, name: val })}
              placeholder="如：DeepSeek"
            />
          </SettingRow>
          
          <SettingRow label="类型">
            <select
              value={formData.type || 'openai'}
              onChange={(e) => handleTypeChange(e.target.value as ProviderConfig['type'])}
              className="w-full rounded-lg bg-neutral-100 px-3 py-2 text-right text-sm outline-none dark:bg-neutral-800"
            >
              <option value="openai">OpenAI 兼容</option>
              <option value="anthropic">Claude (Anthropic)</option>
              <option value="gemini">Google Gemini</option>
            </select>
          </SettingRow>

          <SettingRow label="服务商网站">
            <SettingInput
              value={formData.urls?.website || ''}
              onChange={val =>
                setFormData({
                  ...formData,
                  urls: { ...formData.urls!, website: val },
                })
              }
              placeholder="https://..."
            />
          </SettingRow>
        </SettingSection>

        <SettingSection title="配置">
          <SettingRow label="API Host">
            <SettingInput
              value={formData.settings?.apiHost || ''}
              onChange={val =>
                setFormData({
                  ...formData,
                  settings: { ...formData.settings!, apiHost: val },
                })
              }
              placeholder="https://api.openai.com"
            />
          </SettingRow>
          <SettingRow label="API Key">
            <div className="flex items-center gap-2">
              <SettingInput
                value={formData.settings?.apiKey || ''}
                onChange={val =>
                  setFormData({
                    ...formData,
                    settings: { ...formData.settings!, apiKey: val },
                  })
                }
                placeholder="sk-..."
                type="password"
              />
              <button
                onClick={handleFetchModels}
                disabled={loadingModels || !formData.settings?.apiHost || !formData.settings?.apiKey}
                className="flex h-9 w-9 items-center justify-center rounded-lg bg-neutral-100 text-neutral-600 hover:bg-neutral-200 disabled:opacity-50 dark:bg-neutral-800 dark:text-neutral-400 dark:hover:bg-neutral-700"
                title="获取模型列表"
              >
                {loadingModels ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
              </button>
            </div>
          </SettingRow>

          <SettingRow label="默认模型">
            <div className="flex w-full items-center gap-2">
              <Popover.Root open={modelSelectorOpen} onOpenChange={setModelSelectorOpen}>
                <Popover.Trigger asChild>
                  <button className="flex h-9 w-full items-center justify-between rounded-lg bg-neutral-100 px-3 text-sm text-neutral-900 outline-none hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-100 dark:hover:bg-neutral-700">
                    <span className="truncate">
                      {formData.settings?.models?.[0]?.nickname || 
                       formData.settings?.models?.[0]?.modelId || 
                       '请选择或添加模型'}
                    </span>
                    <ChevronDown className="ml-2 h-4 w-4 opacity-50" />
                  </button>
                </Popover.Trigger>
                <Popover.Portal>
                  <Popover.Content 
                    className="z-50 w-[var(--radix-popover-trigger-width)] min-w-[300px] overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-lg dark:border-neutral-800 dark:bg-neutral-900" 
                    sideOffset={5}
                  >
                    <div className="border-b border-neutral-100 p-2 dark:border-neutral-800">
                      <div className="flex items-center gap-2 rounded-lg bg-neutral-100 px-2 py-1.5 dark:bg-neutral-800">
                        <Search className="h-4 w-4 text-neutral-400" />
                        <input
                          className="flex-1 bg-transparent text-sm outline-none placeholder:text-neutral-400 dark:text-neutral-200"
                          placeholder="搜索模型..."
                          value={modelSearchQuery}
                          onChange={e => setModelSearchQuery(e.target.value)}
                        />
                        {modelSearchQuery && (
                          <button onClick={() => setModelSearchQuery('')}>
                            <X className="h-3 w-3 text-neutral-400 hover:text-neutral-600" />
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="max-h-[300px] overflow-y-auto p-1">
                      {formData.settings?.models && formData.settings.models.length > 0 ? (
                        formData.settings.models.filter(m => 
                          m.modelId.toLowerCase().includes(modelSearchQuery.toLowerCase()) || 
                          (m.nickname && m.nickname.toLowerCase().includes(modelSearchQuery.toLowerCase()))
                        ).map(model => (
                          <button
                            key={model.modelId}
                            onClick={() => {
                                const selectedId = model.modelId;
                                const existingModel = formData.settings?.models?.find(
                                  m => m.modelId === selectedId
                                );
                                if (existingModel && formData.settings?.models) {
                                  // Reorder only, keep strict ref equality for unmodified items if possible?
                                  // Actually just move to top is fine
                                  const newModels = [
                                    existingModel,
                                    ...formData.settings.models.filter(m => m.modelId !== selectedId)
                                  ];
                                  setFormData({
                                    ...formData,
                                    settings: { ...formData.settings!, models: newModels }
                                  });
                                }
                                setModelSelectorOpen(false);
                            }}
                            className={`flex w-full items-center justify-between rounded-lg px-2 py-2 text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800 ${
                              formData.settings?.models?.[0]?.modelId === model.modelId 
                                ? 'bg-neutral-100 font-medium text-neutral-900 dark:bg-neutral-800 dark:text-white' 
                                : 'text-neutral-600 dark:text-neutral-400'
                            }`}
                          >
                            <div className="flex flex-col items-start gap-0.5 overflow-hidden">
                              <span className="truncate">{model.nickname || model.modelId}</span>
                              {model.nickname && <span className="text-xs text-neutral-400">{model.modelId}</span>}
                            </div>
                            {formData.settings?.models?.[0]?.modelId === model.modelId && (
                                <Check className="h-4 w-4 text-green-600" />
                            )}
                          </button>
                        ))
                      ) : (
                        <div className="py-4 text-center text-xs text-neutral-400">
                          暂无模型，请先获取
                        </div>
                      )}
                      
                      {/* Empty state for search */}
                      {formData.settings?.models && 
                       formData.settings.models.length > 0 && 
                       formData.settings.models.filter(m => 
                          m.modelId.toLowerCase().includes(modelSearchQuery.toLowerCase())
                       ).length === 0 && (
                         <div className="py-4 text-center text-xs text-neutral-400">
                           未找到匹配模型
                         </div>
                       )}
                    </div>
                  </Popover.Content>
                </Popover.Portal>
              </Popover.Root>

              <button
                onClick={handleAddCustomModel}
                className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-neutral-100 text-neutral-600 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-400 dark:hover:bg-neutral-700"
                title="手动添加模型"
              >
                <Plus className="h-4 w-4" />
              </button>
              
              <button
                  onClick={handleTestConnection}
                  disabled={testingConnection || !formData.settings?.apiHost || !formData.settings?.apiKey}
                  className={`flex h-9 flex-shrink-0 items-center justify-center gap-1 rounded-lg px-3 transition-colors ${
                    connectionStatus === 'success' 
                      ? 'bg-green-100 text-green-600 dark:bg-green-900/20 dark:text-green-400'
                      : connectionStatus === 'error'
                      ? 'bg-red-100 text-red-600 dark:bg-red-900/20 dark:text-red-400'
                      : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-400 dark:hover:bg-neutral-700'
                  }`}
                  title="测试连接"
                >
                  {testingConnection ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Play className="h-4 w-4" />
                  )}
                  <span className="text-xs font-medium">
                    测试连接
                  </span>
                </button>
            </div>
            
            {(testResults.text !== 'idle' || testingConnection) && (
              <div className="mt-2 flex flex-wrap items-center gap-4 rounded-lg bg-neutral-50 px-3 py-2 text-xs dark:bg-neutral-900/50">
                <div className="flex items-center gap-1.5">
                  <span className="text-neutral-500">Text</span>
                  {testResults.text === 'loading' ? <Loader2 className="h-2.5 w-2.5 animate-spin text-neutral-400"/> : 
                   testResults.text === 'success' ? <div className="h-2 w-2 rounded-full bg-green-500" /> :
                   testResults.text === 'error' ? <div className="h-2 w-2 rounded-full bg-red-500" /> :
                   <div className="h-2 w-2 rounded-full bg-neutral-300" />}
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-neutral-500">Vision</span>
                  {testResults.vision === 'loading' ? <Loader2 className="h-2.5 w-2.5 animate-spin text-neutral-400"/> : 
                   testResults.vision === 'success' ? <div className="h-2 w-2 rounded-full bg-green-500" /> :
                   testResults.vision === 'error' ? <div className="h-2 w-2 rounded-full bg-red-500" /> :
                   <div className="h-2 w-2 rounded-full bg-neutral-300" />}
                </div>
                <div className="flex items-center gap-1.5" title={testResults.toolMessage === 'No tool call' ? '不支持' : undefined}>
                  <span className="text-neutral-500">Tools</span>
                  {testResults.tools === 'loading' ? <Loader2 className="h-2.5 w-2.5 animate-spin text-neutral-400"/> : 
                   testResults.tools === 'success' ? <div className="h-2 w-2 rounded-full bg-green-500" /> :
                   testResults.tools === 'error' ? <div className="h-2 w-2 rounded-full bg-red-500" /> :
                   <div className="h-2 w-2 rounded-full bg-neutral-300" />}
                </div>
              </div>
            )}
          </SettingRow>

          {/* Model Detail Editing */}
          {formData.settings?.models?.[0] && (
            <div className="mt-4 rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-3 dark:border-neutral-800 dark:bg-neutral-900/50">
              <button
                onClick={() => setShowAdvancedModelSettings(!showAdvancedModelSettings)}
                className="flex w-full items-center justify-between text-xs font-medium text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200"
              >
                <span>模型详细配置 ({formData.settings.models[0].modelId})</span>
                {showAdvancedModelSettings ? (
                  <ChevronUp className="h-3.5 w-3.5" />
                ) : (
                  <ChevronDown className="h-3.5 w-3.5" />
                )}
              </button>

              {showAdvancedModelSettings && (
                <div className="mt-3 space-y-3">
                  {/* Nickname */}
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-neutral-600 dark:text-neutral-400">别名 (Nickname)</span>
                    <input
                      value={formData.settings.models[0].nickname || ''}
                      onChange={e => {
                        const newModels = [...formData.settings!.models!];
                        newModels[0] = { ...newModels[0], nickname: e.target.value };
                        setFormData({
                          ...formData,
                          settings: { ...formData.settings!, models: newModels }
                        });
                      }}
                      className="w-40 rounded-lg border border-neutral-200 bg-white px-2 py-1.5 text-right text-xs outline-none dark:border-neutral-700 dark:bg-neutral-800"
                      placeholder="可选"
                    />
                  </div>

                  {/* Type */}
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-neutral-600 dark:text-neutral-400">类型 (Type)</span>
                    <select
                      value={formData.settings.models[0].type || 'chat'}
                      onChange={e => {
                        const newModels = [...formData.settings!.models!];
                        newModels[0] = { ...newModels[0], type: e.target.value as any };
                        setFormData({
                          ...formData,
                          settings: { ...formData.settings!, models: newModels }
                        });
                      }}
                      className="w-40 rounded-lg border border-neutral-200 bg-white px-2 py-1.5 text-right text-xs outline-none dark:border-neutral-700 dark:bg-neutral-800"
                    >
                      <option value="chat">对话 (Chat)</option>
                      <option value="embedding">Embedding</option>
                      <option value="rerank">Rerank</option>
                    </select>
                  </div>

                  {/* Capabilities */}
                  <div className="space-y-2">
                    <span className="text-xs text-neutral-600 dark:text-neutral-400">能力 (Capabilities)</span>
                    <div className="flex flex-wrap gap-2">
                      {[
                        { id: 'vision', label: 'Vision' },
                        { id: 'reasoning', label: 'Reasoning' },
                        { id: 'tool_use', label: 'Tool Use' },
                      ].map(cap => {
                        const capabilities = formData.settings!.models[0].capabilities || [];
                        const isSelected = capabilities.includes(cap.id as any);
                        return (
                          <button
                            key={cap.id}
                            onClick={() => {
                              const newCaps = isSelected
                                ? capabilities.filter(c => c !== cap.id)
                                : [...capabilities, cap.id as any];
                              
                              const newModels = [...formData.settings!.models!];
                              newModels[0] = { ...newModels[0], capabilities: newCaps };
                              setFormData({
                                ...formData,
                                settings: { ...formData.settings!, models: newModels }
                              });
                            }}
                            className={`rounded-md border px-2 py-1 text-xs transition-colors ${
                              isSelected
                                ? 'border-neutral-900 bg-neutral-900 text-white dark:border-neutral-100 dark:bg-neutral-100 dark:text-neutral-900'
                                : 'border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700'
                            }`}
                          >
                            {cap.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Context Window & Max Output */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <span className="text-xs text-neutral-600 dark:text-neutral-400">Context Window</span>
                      <input
                        type="number"
                        value={formData.settings.models[0].contextWindow || ''}
                        onChange={e => {
                          const val = e.target.value ? parseInt(e.target.value) : undefined;
                          const newModels = [...formData.settings!.models!];
                          newModels[0] = { ...newModels[0], contextWindow: val };
                          setFormData({
                            ...formData,
                            settings: { ...formData.settings!, models: newModels }
                          });
                        }}
                        className="w-full rounded-lg border border-neutral-200 bg-white px-2 py-1.5 text-xs outline-none dark:border-neutral-700 dark:bg-neutral-800"
                        placeholder="e.g. 128000"
                      />
                    </div>
                    <div className="space-y-1">
                      <span className="text-xs text-neutral-600 dark:text-neutral-400">Max Output</span>
                      <input
                        type="number"
                        value={formData.settings.models[0].maxOutput || ''}
                        onChange={e => {
                          const val = e.target.value ? parseInt(e.target.value) : undefined;
                          const newModels = [...formData.settings!.models!];
                          newModels[0] = { ...newModels[0], maxOutput: val };
                          setFormData({
                            ...formData,
                            settings: { ...formData.settings!, models: newModels }
                          });
                        }}
                        className="w-full rounded-lg border border-neutral-200 bg-white px-2 py-1.5 text-xs outline-none dark:border-neutral-700 dark:bg-neutral-800"
                        placeholder="e.g. 4096"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </SettingSection>

        <div className="flex justify-center p-4">
          <button
            onClick={handleSave}
            className="w-full rounded-xl bg-neutral-900 py-3 font-medium text-white active:scale-95 dark:bg-neutral-100 dark:text-neutral-900"
          >
            保存配置
          </button>
        </div>
      </SettingPage>
    );
  }

  return (
    <SettingPage title="AI 服务" isVisible={isVisible} onClose={onClose}>

      <SettingSection 
        title="功能模块配置" 
        footer="为不同功能指定特定的 AI 服务和提示词。自定义提示词将覆盖默认设置。"
      >
        {[
          { key: 'dailyRecommendation', label: '每日豆卡推荐', requiredCapability: 'text' },
          { key: 'beanRecognition', label: '咖啡豆识别', requiredCapability: 'vision' },
          { key: 'methodRecognition', label: '冲煮方案识别', requiredCapability: 'vision' },
          { key: 'yearlyReport', label: '年度报告生成', requiredCapability: 'text' },
          { key: 'feedbackModeration', label: '内容审核', requiredCapability: 'text' },
        ].map(feature => {
          const binding = settings.aiSettings?.featureBindings?.[feature.key as keyof typeof settings.aiSettings.featureBindings] || {};
          
          // Filter providers based on capability
          const validProviders = providers.filter(p => {
             if (feature.requiredCapability === 'vision') {
               return p.settings.models.some(m => m.capabilities?.includes('vision'));
             }
             // Default to true for text/chat as most providers support it
             return true;
          });

          return (
            <div key={feature.key} className="flex flex-col gap-2 border-b border-neutral-100 py-3 last:border-0 dark:border-neutral-800">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                  {feature.label}
                  {feature.requiredCapability === 'vision' && (
                    <span className="ml-1 text-xs text-neutral-400 font-normal">(需 Vision 能力)</span>
                  )}
                </span>
                <select
                  value={binding.providerId || ''}
                  onChange={async (e) => {
                     const val = e.target.value;
                     await updateSettings({
                       aiSettings: {
                         ...settings.aiSettings!,
                         featureBindings: {
                           ...settings.aiSettings?.featureBindings,
                           [feature.key]: {
                             ...binding,
                             providerId: val || undefined
                           }
                         }
                       }
                     });
                  }}
                  className="w-40 rounded-lg bg-neutral-100 px-3 py-1.5 text-right text-sm outline-none dark:bg-neutral-800"
                >
                  <option value="">跟随默认 ({providers.find(p => p.id === activeProviderId)?.name || '未设置'})</option>
                  {validProviders.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
              
              <div className="flex items-center justify-between pl-0">
                 <button
                   onClick={() => {
                     // Open prompt editor
                     // Since we don't have a separate modal state for this yet, we might need to add one.
                     // For now, let's use the local state `editingProviderId` hack or add a new state.
                     // Let's add `editingPromptKeys` state to `AISettings`.
                     // Since I can't easily add state in this tool call without replacing the whole file,
                     // I will assume I will add `editingPromptKey` state in a separate tool call.
                     // But I need to trigger it here.
                     // Let's rely on a new function `handleEditPrompt(featureKey)`
                     handleEditPrompt(feature.key);
                   }}
                   className="text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                 >
                   {binding.prompt ? '编辑自定义提示词 (已修改)' : '自定义提示词'}
                 </button>
                 {binding.modelId && (
                   <span className="text-xs text-neutral-400">特定模型: {binding.modelId}</span>
                 )}
              </div>
            </div>
          );
        })}
      </SettingSection>

      <SettingSection
        title="已配置的服务"
        footer="选择一个服务作为默认的 AI 提供方，用于每日豆卡推荐和年度报告生成。"
      >
        {providers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-neutral-400">
            <Bot className="mb-2 h-10 w-10 opacity-20" />
            <p className="text-sm">暂无配置的 AI 服务</p>
          </div>
        ) : (
          providers.map(provider => {
            // Calculate capabilities
            const capabilities = new Set<string>();
            // Assuming all chat models support Text
            if (provider.settings.models.some(m => m.type === 'chat')) {
              capabilities.add('Text');
            }
            if (provider.settings.models.some(m => m.capabilities?.includes('vision'))) {
              capabilities.add('Vision');
            }
            if (provider.settings.models.some(m => m.capabilities?.includes('reasoning'))) {
              capabilities.add('Reasoning');
            }
            if (provider.settings.models.some(m => m.capabilities?.includes('tool_use'))) {
              capabilities.add('Tool Use');
            }

            return (
            <div
              key={provider.id}
              className="flex items-center justify-between border-b border-neutral-100 bg-white px-4 py-3 last:border-0 active:bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900 dark:active:bg-neutral-800"
              onClick={() => setActiveAIProvider(provider.id)}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`flex h-5 w-5 items-center justify-center rounded-full border ${
                    activeProviderId === provider.id
                      ? 'border-neutral-900 bg-neutral-900 dark:border-neutral-100 dark:bg-neutral-100'
                      : 'border-neutral-300 dark:border-neutral-600'
                  }`}
                >
                  {activeProviderId === provider.id && (
                    <Check className="h-3 w-3 text-white dark:text-neutral-900" />
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-neutral-900 dark:text-neutral-100">
                      {provider.name}
                    </span>
                    <div className="flex gap-1">
                      {Array.from(capabilities).map(cap => (
                        <span key={cap} className="rounded-full bg-neutral-100 px-1.5 py-0.5 text-[10px] text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400">
                          {cap}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="text-xs text-neutral-500">
                    {provider.settings.apiHost}
                    {provider.settings.models?.[0] && (
                      <span className="opacity-75"> • {provider.settings.models[0].nickname || provider.settings.models[0].modelId}</span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={e => {
                    e.stopPropagation();
                    handleEdit(provider);
                  }}
                  className="rounded-full p-2 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600 dark:hover:bg-neutral-800 dark:hover:text-neutral-300"
                >
                  <SettingsIcon className="h-4 w-4" />
                </button>
                <button
                  onClick={e => {
                    e.stopPropagation();
                    handleDelete(provider.id);
                  }}
                  className="rounded-full p-2 text-neutral-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/20 dark:hover:text-red-400"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          )})
        )}
      </SettingSection>

      <SettingSection>
        <button
          onClick={handleCreateNew}
          className="flex w-full items-center justify-center gap-2 py-3 text-neutral-900 active:bg-neutral-50 dark:text-neutral-100 dark:active:bg-neutral-800"
        >
          <Plus className="h-5 w-5" />
          <span>添加 MCP AI 服务</span>
        </button>
      </SettingSection>

      {/* Prompt Editing Modal */}
      {editingPromptKey && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-xl dark:bg-neutral-900">
            <h3 className="mb-4 text-lg font-bold text-neutral-900 dark:text-white">
              配置提示词 (Prompt)
            </h3>
            <div className="mb-4 text-xs text-neutral-500">
              当前正在编辑 {editingPromptKey} 的提示词。留空则使用系统默认提示词。
            </div>
            
            <textarea
                  value={tempPrompt}
                  onChange={(e) => setTempPrompt(e.target.value)}
                  placeholder={defaultPrompts[editingPromptKey] ? "在此处编辑...\n\n(已自动加载系统默认提示词作为参考)" : "在此输入自定义提示词..."}
                  className="h-96 w-full rounded-lg border border-neutral-200 bg-neutral-50 p-4 text-sm leading-relaxed outline-none focus:border-neutral-400 focus:ring-1 focus:ring-neutral-400 dark:border-neutral-700 dark:bg-neutral-900"
                />
                <div className="mt-2 flex justify-between text-xs text-neutral-400">
                  <span>支持使用 {'{{history}}'} 和 {'{{inventory}}'} 占位符</span>
                  {defaultPrompts[editingPromptKey] && !tempPrompt && (
                    <button 
                      onClick={() => setTempPrompt(defaultPrompts[editingPromptKey])}
                      className="text-amber-600 hover:underline dark:text-amber-400"
                    >
                      恢复默认模板
                    </button>
                  )}
                </div>
            
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setEditingPromptKey(null)}
                className="rounded-lg px-4 py-2 text-sm text-neutral-600 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800"
              >
                取消
              </button>
              <button
                onClick={savePrompt}
                className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-200"
              >
                保存
              </button>
            </div>
          </div>
        </div>
      )}
    </SettingPage>
  );
};

export default AISettings;
