'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { type Method, type CustomEquipment } from '@/lib/core/config';
import { useThemeColor } from '@/lib/hooks/useThemeColor';
import { showToast } from '@/components/common/feedback/LightToast';
import { useModalHistory, modalHistory } from '@/lib/hooks/useModalHistory';

interface MethodImportModalProps {
  showForm: boolean;
  onImport: (method: Method) => void;
  onClose: () => void;
  existingMethods?: Method[];
  customEquipment?: CustomEquipment;
}

const MethodImportModal: React.FC<MethodImportModalProps> = ({
  showForm,
  onImport,
  onClose,
  existingMethods = [],
  customEquipment,
}) => {
  // 动画状态管理
  const [shouldRender, setShouldRender] = useState(false);

  // 同步顶部安全区颜色
  useThemeColor({ useOverlay: true, enabled: showForm });

  // 导入数据的状态
  const [importData, setImportData] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);

  // 清除所有状态消息
  const clearMessages = () => {
    setError(null);
  };

  // 处理显示/隐藏动画
  useEffect(() => {
    if (showForm) {
      setShouldRender(true);
    } else {
      const timer = setTimeout(() => setShouldRender(false), 300);
      return () => clearTimeout(timer);
    }
  }, [showForm]);

  // 监听showForm变化，当表单关闭时清除输入框内容
  React.useEffect(() => {
    if (!showForm) {
      setImportData('');
      clearMessages();
    }
  }, [showForm]);

  // 使用新的历史栈管理系统
  useModalHistory({
    id: 'method-import',
    isOpen: showForm,
    onClose,
  });

  // 关闭并清除输入（使用新的历史栈系统）
  const handleClose = useCallback(() => {
    setImportData('');
    clearMessages();
    modalHistory.back();
  }, []);

  // 生成模板提示词
  const _templatePrompt = (() => {
    return `提取咖啡冲煮方案数据，返回JSON格式。

格式要求：
{
  "name": "方案名称",
  "params": {
    "coffee": "咖啡粉量，如15g",
    "water": "水量，如225g",
    "ratio": "比例，如1:15",
    "grindSize": "研磨度，如中细",
    "temp": "水温，如92°C",
    "stages": [
      {
        "time": 分钟*60+秒钟，纯数字,
        "pourTime": 注水时间，纯数字，单位秒,
        "label": "步骤操作简述（如焖蒸(绕圈注水)、绕圈注水、中心注水）",
        "water": "该步骤水量，如40g",
        "detail": "描述注水方式，如中心向外缓慢画圈注水，均匀萃取咖啡风味",
        "pourType": "注水方式严格按照center（中心注水）、circle（绕圈注水）、ice（冰水）、bypass（Bypass）、other（其他）"
      }
    ]
  }
}

要求：
0. 所有字段必须填写
1. stages数组必须包含至少一个步骤
2. time表示该步骤从开始到结束的总时间（秒），pourTime表示注水时长（秒）
3. 步骤的time值必须按递增顺序排列
4. 确保JSON格式有效，数值字段不包含单位

提示：一般焖蒸注水方式是center，label就是"焖蒸(绕圈注水)"，
`;
  })();

  // 兼容性更好的复制文本方法
  const _copyTextToClipboard = async (text: string) => {
    try {
      // 首先尝试使用现代API
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
        showToast({ type: 'success', title: '复制成功' });
        return;
      }

      // 回退方法：创建临时textarea元素
      const textArea = document.createElement('textarea');
      textArea.value = text;

      // 设置样式使其不可见
      textArea.style.position = 'fixed';
      textArea.style.left = '-999999px';
      textArea.style.top = '-999999px';
      document.body.appendChild(textArea);

      // 选择文本并复制
      textArea.focus();
      textArea.select();

      const successful = document.execCommand('copy');
      if (successful) {
        showToast({ type: 'success', title: '复制成功' });
      } else {
        showToast({ type: 'error', title: '复制失败' });
      }
    } catch (_err) {
      showToast({ type: 'error', title: '复制失败' });
    } finally {
      if (document.querySelector('textarea[style*="-999999px"]')) {
        document.body.removeChild(
          document.querySelector('textarea[style*="-999999px"]')!
        );
      }
    }
  };

  // 处理导入数据
  const handleImport = () => {
    if (!importData) {
      setError('请输入要导入的数据');
      return;
    }

    try {
      // 尝试从文本中提取数据
      import('@/lib/utils/jsonUtils')
        .then(async ({ extractJsonFromText }) => {
          setError(null);
          // 解析导入数据，传递自定义器具配置
          const method = extractJsonFromText(
            importData,
            customEquipment
          ) as Method;

          if (!method) {
            setError('无法从输入中提取有效数据');
            return;
          }

          // 验证方法对象是否有必要的字段
          if (!method.name) {
            // 尝试获取method字段，使用接口扩展
            interface ExtendedMethod extends Method {
              method?: string;
            }
            const extendedMethod = method as ExtendedMethod;
            if (typeof extendedMethod.method === 'string') {
              // 如果有method字段，使用它作为name
              method.name = extendedMethod.method;
            } else {
              setError('冲煮方案缺少名称');
              return;
            }
          }

          // 验证params
          if (!method.params) {
            setError('冲煮方案格式不完整，缺少参数字段');
            return;
          }

          // 验证stages
          if (!method.params.stages || method.params.stages.length === 0) {
            setError('冲煮方案格式不完整，缺少冲煮步骤');
            return;
          }

          // 检查是否已存在同名方案
          const existingMethod = existingMethods.find(
            m => m.name === method.name
          );
          if (existingMethod) {
            setError(`已存在同名方案"${method.name}"，请修改后再导入`);
            return;
          }

          // 确保method对象完全符合Method接口
          const validMethod: Method = {
            id:
              method.id ||
              `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            name: method.name,
            params: {
              coffee: method.params.coffee || '15g',
              water: method.params.water || '225g',
              ratio: method.params.ratio || '1:15',
              grindSize: method.params.grindSize || '中细',
              temp: method.params.temp || '92°C',
              stages: method.params.stages,
            },
          };

          // 导入方案
          onImport(validMethod);
          // 导入成功后清空输入框和错误信息
          setImportData('');
          setError(null);
          // 关闭模态框
          handleClose();
        })
        .catch(err => {
          setError(
            '解析数据失败: ' + (err instanceof Error ? err.message : '未知错误')
          );
        });
    } catch (err) {
      setError(
        '导入失败: ' + (err instanceof Error ? err.message : '未知错误')
      );
    }
  };

  // 渲染提示词部分
  const renderPromptSection = () => (
    <div className="space-y-3">
      <button
        onClick={() => setShowPrompt(!showPrompt)}
        className="flex w-full items-center gap-2 text-xs text-neutral-500 dark:text-neutral-400"
      >
        <svg
          className={`h-3.5 w-3.5 transition-transform ${showPrompt ? 'rotate-90' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 5l7 7-7 7"
          />
        </svg>
        <span>使用提示词生成方案</span>
      </button>
      <AnimatePresence>
        {showPrompt && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="space-y-2 rounded-lg border border-neutral-200/50 bg-neutral-100/60 p-3 dark:border-neutral-700 dark:bg-neutral-800/30">
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                将此提示词和你的冲煮方案一起发给 ChatGPT、Claude 等 AI
              </p>
              <textarea
                readOnly
                value={_templatePrompt}
                className="h-24 w-full resize-none rounded border border-neutral-200/50 bg-white/60 p-2 text-[10px] leading-relaxed text-neutral-600 focus:outline-none dark:border-neutral-600 dark:bg-neutral-900/60 dark:text-neutral-400"
                onFocus={e => e.target.select()}
              />
              <button
                onClick={() => {
                  clearMessages();
                  _copyTextToClipboard(_templatePrompt);
                }}
                className="w-full rounded-lg bg-neutral-800 px-3 py-1.5 text-xs text-white transition-opacity hover:opacity-80 dark:bg-neutral-200 dark:text-neutral-800"
              >
                复制提示词
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );

  if (!shouldRender) return null;

  return (
    <AnimatePresence>
      {showForm && (
        <motion.div
          data-modal={showForm ? 'method-import' : undefined}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.265 }}
          className="fixed inset-0 z-50 bg-black/50"
        >
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{
              ease: [0.33, 1, 0.68, 1],
              duration: 0.265,
            }}
            style={{ willChange: 'transform' }}
            className="absolute inset-x-0 bottom-0 mx-auto max-h-[90vh] max-w-md overflow-hidden rounded-t-2xl bg-neutral-50 shadow-xl dark:bg-neutral-900"
          >
            {/* 拖动条 */}
            <div className="sticky top-0 z-10 flex justify-center bg-neutral-50 py-2 dark:bg-neutral-900">
              <div className="h-1.5 w-12 rounded-full bg-neutral-200 dark:bg-neutral-700" />
            </div>

            {/* 表单内容 */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: 0.265,
                delay: 0.05,
              }}
              style={{ willChange: 'opacity, transform' }}
              className="pb-safe-bottom max-h-[calc(90vh-40px)] overflow-auto px-6"
            >
              <div className="flex flex-col">
                {/* 顶部标题 */}
                <div className="mb-4 flex items-center justify-between py-4">
                  <button
                    type="button"
                    onClick={handleClose}
                    className="rounded-full p-1.5 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-700 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-200"
                  >
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        d="M19 12H5M5 12L12 19M5 12L12 5"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </button>
                  <h3 className="text-base font-medium text-neutral-900 dark:text-neutral-100">
                    导入冲煮方案
                  </h3>
                  <div className="w-8"></div>
                </div>

                {/* 表单内容 */}
                <div className="space-y-4 pb-4">
                  <textarea
                    className="h-48 w-full resize-none rounded-lg border border-neutral-200/50 bg-neutral-100/60 p-3 text-sm text-neutral-800 placeholder-neutral-500 transition-colors focus:border-neutral-800/50 focus:outline-hidden dark:border-neutral-700 dark:bg-neutral-800/30 dark:text-neutral-200 dark:placeholder-neutral-400 dark:focus:border-neutral-200"
                    placeholder="粘贴方案数据或朋友分享的 JSON"
                    value={importData}
                    onChange={e => setImportData(e.target.value)}
                  />

                  {renderPromptSection()}

                  {error && (
                    <div className="rounded-lg bg-red-100/60 p-3 text-sm text-red-600 dark:bg-red-900/30 dark:text-red-400">
                      {error}
                    </div>
                  )}

                  {/* 导入按钮 - 固定位置，根据输入内容改变透明度和模糊度 */}
                  <motion.button
                    initial={{
                      opacity: 0,
                    }}
                    animate={{
                      opacity: importData.trim() ? 1 : 0,
                    }}
                    transition={{ duration: 0.2 }}
                    onClick={handleImport}
                    disabled={!importData.trim()}
                    className="w-full rounded-lg bg-neutral-800 px-4 py-2.5 text-neutral-100 transition-opacity hover:opacity-80 disabled:pointer-events-none dark:bg-neutral-200 dark:text-neutral-800"
                  >
                    导入
                  </motion.button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default MethodImportModal;
