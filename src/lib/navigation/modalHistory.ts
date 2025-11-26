/**
 * 统一历史栈管理器
 *
 * 解决 SPA 中模态框的历史栈管理问题：
 * 1. 支持浏览器返回键关闭模态框
 * 2. 支持 Android 硬件返回键
 * 3. 支持 iOS 侧滑返回
 * 4. 支持多层嵌套模态框
 * 5. 支持主动关闭（如表单提交后关闭）
 *
 * 核心原则：
 * - 浏览器返回触发 popstate -> closeTop -> onClose
 * - 主动关闭调用 close/closeById -> 清理内部栈 + 清理浏览器历史
 * - 单一 popstate 监听器处理所有模态框
 */

export interface ModalEntry {
  id: string;
  onClose: () => void;
  /**
   * 可选的步骤标识，用于多步骤表单
   * 如 'bean-form' 模态框可能有 step: 1, 2, 3, 4
   */
  step?: number;
  /**
   * 步骤变化回调，用于多步骤表单
   * 当历史返回时，通知组件更新当前步骤
   */
  onStepChange?: (step: number) => void;
}

interface ModalHistoryState {
  stack: ModalEntry[];
  isProcessing: boolean; // 防止重复处理
  // 标记是否正在执行主动关闭，避免 popstate 重复处理
  isClosingProgrammatically: boolean;
}

// 用于标识我们添加的历史记录
const HISTORY_STATE_KEY = '__modalHistory__';

class ModalHistoryManager {
  private state: ModalHistoryState = {
    stack: [],
    isProcessing: false,
    isClosingProgrammatically: false,
  };

  private popstateHandler: ((event: PopStateEvent) => void) | null = null;
  private isInitialized = false;

  /**
   * 初始化管理器
   * 应该在应用启动时调用一次
   */
  init(): void {
    if (this.isInitialized || typeof window === 'undefined') {
      return;
    }

    this.popstateHandler = this.handlePopState.bind(this);
    window.addEventListener('popstate', this.popstateHandler);
    this.isInitialized = true;

    // 开发环境下输出调试信息
    if (process.env.NODE_ENV === 'development') {
      console.log('[ModalHistory] 初始化完成');
    }
  }

  /**
   * 销毁管理器
   * 通常不需要调用，除非在测试环境
   */
  destroy(): void {
    if (this.popstateHandler) {
      window.removeEventListener('popstate', this.popstateHandler);
      this.popstateHandler = null;
    }
    this.state = {
      stack: [],
      isProcessing: false,
      isClosingProgrammatically: false,
    };
    this.isInitialized = false;
  }

  /**
   * 注册模态框
   * @returns 清理函数
   */
  register(entry: ModalEntry): () => void {
    // 确保已初始化
    if (!this.isInitialized) {
      this.init();
    }

    // 检查是否已存在相同 id
    const existingIndex = this.state.stack.findIndex(m => m.id === entry.id);
    if (existingIndex !== -1) {
      // 已存在，更新回调但不重复添加历史记录
      this.state.stack[existingIndex] = entry;
      return () => this.unregister(entry.id);
    }

    // 添加到栈
    this.state.stack.push(entry);

    // 添加历史记录
    window.history.pushState({ [HISTORY_STATE_KEY]: entry.id }, '');

    if (process.env.NODE_ENV === 'development') {
      console.log(`[ModalHistory] 注册: ${entry.id}`, this.getStackIds());
    }

    // 返回清理函数
    return () => this.unregister(entry.id);
  }

  /**
   * 注销模态框
   * 仅从内部栈移除，不触发历史操作
   */
  private unregister(id: string): void {
    const index = this.state.stack.findIndex(m => m.id === id);
    if (index !== -1) {
      this.state.stack.splice(index, 1);
      if (process.env.NODE_ENV === 'development') {
        console.log(`[ModalHistory] 注销: ${id}`, this.getStackIds());
      }
    }
  }

  /**
   * 处理 popstate 事件
   */
  private handlePopState(event: PopStateEvent): void {
    // 如果是主动关闭触发的 popstate，跳过处理
    if (this.state.isClosingProgrammatically) {
      return;
    }

    // 防止重复处理
    if (this.state.isProcessing) {
      return;
    }

    // 检查是否是我们管理的历史记录
    // 当用户点击返回时，我们需要关闭栈顶的模态框
    const top = this.state.stack[this.state.stack.length - 1];
    if (!top) {
      // 栈为空，不处理
      return;
    }

    // 检查当前历史状态
    // 如果当前状态不包含我们的标记，说明用户已经返回到了模态框之前的页面
    const currentState = event.state;
    const isOurState = currentState?.[HISTORY_STATE_KEY];

    // 如果当前状态是我们的，且不是栈顶模态框的状态，说明需要关闭栈顶
    // 如果当前状态不是我们的，也需要关闭栈顶（用户返回到了根页面）
    this.closeTop();
  }

  /**
   * 关闭栈顶模态框
   */
  private closeTop(): void {
    const top = this.state.stack[this.state.stack.length - 1];
    if (!top) {
      return;
    }

    // 检查是否是多步骤表单的中间步骤
    if (top.step !== undefined && top.step > 1) {
      // 查找同一模态框的上一步
      const baseId = top.id.replace(/-step-\d+$/, '');
      const prevStep = top.step - 1;
      const prevEntryIndex = this.state.stack.findIndex(
        m =>
          m.id === `${baseId}-step-${prevStep}` ||
          (m.id === baseId && prevStep === 1)
      );

      if (prevEntryIndex !== -1) {
        // 从栈中移除当前步骤
        this.state.stack.pop();
        // 通知组件更新步骤
        const prevEntry = this.state.stack[prevEntryIndex];
        prevEntry.onStepChange?.(prevStep);

        if (process.env.NODE_ENV === 'development') {
          console.log(
            `[ModalHistory] 返回步骤: ${top.id} -> step ${prevStep}`,
            this.getStackIds()
          );
        }
        return;
      }
    }

    // 从栈中移除
    this.state.stack.pop();
    this.state.isProcessing = true;

    if (process.env.NODE_ENV === 'development') {
      console.log(`[ModalHistory] 关闭: ${top.id}`, this.getStackIds());
    }

    // 直接调用 onClose，让组件自己处理动画
    // 组件通过 isOpen 状态变化触发动画，无需历史栈管理延迟
    top.onClose();
    this.state.isProcessing = false;
  }

  /**
   * 返回上一层（关闭栈顶模态框）
   * 这是组件应该调用的方法
   */
  back(): void {
    if (this.state.stack.length === 0) {
      return;
    }

    // 通过 history.back() 触发 popstate，保持统一的关闭路径
    window.history.back();
  }

  /**
   * 返回到指定模态框（关闭其上的所有模态框）
   */
  backTo(targetId: string): void {
    const targetIndex = this.state.stack.findIndex(m => m.id === targetId);
    if (targetIndex === -1) {
      // 目标不在栈中，关闭所有
      this.backToRoot();
      return;
    }

    // 需要关闭的层数
    const closeCount = this.state.stack.length - targetIndex - 1;
    if (closeCount <= 0) {
      return;
    }

    // 使用 history.go 一次性返回多层
    window.history.go(-closeCount);
  }

  /**
   * 返回到根页面（关闭所有模态框）
   */
  backToRoot(): void {
    const closeCount = this.state.stack.length;
    if (closeCount === 0) {
      return;
    }

    // 一次性关闭所有
    window.history.go(-closeCount);
  }

  /**
   * 检查某个模态框是否打开
   */
  isOpen(id: string): boolean {
    return this.state.stack.some(m => m.id === id);
  }

  /**
   * 检查某个模态框是否在栈顶
   */
  isTop(id: string): boolean {
    const top = this.state.stack[this.state.stack.length - 1];
    return top?.id === id;
  }

  /**
   * 获取当前栈的 id 列表（调试用）
   */
  getStackIds(): string[] {
    return this.state.stack.map(m => m.id);
  }

  /**
   * 获取栈的长度
   */
  getStackLength(): number {
    return this.state.stack.length;
  }

  /**
   * 替换栈顶模态框（用于特殊场景，如从详情页进入编辑页）
   */
  replace(entry: ModalEntry): () => void {
    // 确保已初始化
    if (!this.isInitialized) {
      this.init();
    }

    // 移除栈顶
    const top = this.state.stack.pop();

    // 添加新的
    this.state.stack.push(entry);

    // 替换历史记录
    window.history.replaceState({ [HISTORY_STATE_KEY]: entry.id }, '');

    if (process.env.NODE_ENV === 'development') {
      console.log(
        `[ModalHistory] 替换: ${top?.id} -> ${entry.id}`,
        this.getStackIds()
      );
    }

    return () => this.unregister(entry.id);
  }

  /**
   * 清空栈（不触发历史操作）
   * 用于页面刷新或特殊重置场景
   */
  clear(): void {
    this.state.stack = [];
    this.state.isProcessing = false;
    this.state.isClosingProgrammatically = false;
    if (process.env.NODE_ENV === 'development') {
      console.log('[ModalHistory] 栈已清空');
    }
  }

  /**
   * 主动关闭指定模态框并清理浏览器历史
   * 用于表单提交成功后关闭、页面跳转时关闭等场景
   *
   * @param id 要关闭的模态框 ID
   * @param skipOnClose 是否跳过 onClose 回调（默认 true，因为调用者通常已经处理了关闭逻辑）
   */
  close(id: string, skipOnClose = true): void {
    const index = this.state.stack.findIndex(m => m.id === id);
    if (index === -1) {
      return;
    }

    // 计算需要返回的历史记录数量（从该模态框到栈顶的所有条目）
    const closeCount = this.state.stack.length - index;

    // 从栈中移除
    const removed = this.state.stack.splice(index, closeCount);

    if (process.env.NODE_ENV === 'development') {
      console.log(
        `[ModalHistory] 主动关闭: ${removed.map(e => e.id).join(', ')}`,
        this.getStackIds()
      );
    }

    // 清理浏览器历史
    if (closeCount > 0) {
      this.state.isClosingProgrammatically = true;
      window.history.go(-closeCount);
      // 在下一个事件循环中重置标志
      setTimeout(() => {
        this.state.isClosingProgrammatically = false;
      }, 50);
    }

    // 如果不跳过 onClose，调用最底层被关闭模态框的 onClose
    if (!skipOnClose && removed.length > 0) {
      removed[0].onClose();
    }
  }

  /**
   * 关闭所有以指定前缀开头的模态框
   * 专门用于多步骤表单完成后关闭所有步骤
   *
   * @param prefix 模态框 ID 前缀，如 'bean-form'
   * @param skipOnClose 是否跳过 onClose 回调
   */
  closeAllByPrefix(prefix: string, skipOnClose = true): void {
    // 找到第一个匹配的模态框
    const firstIndex = this.state.stack.findIndex(
      m => m.id === prefix || m.id.startsWith(`${prefix}-step-`)
    );

    if (firstIndex === -1) {
      return;
    }

    // 计算需要关闭的数量（从第一个匹配到栈顶）
    const closeCount = this.state.stack.length - firstIndex;

    // 从栈中移除
    const removed = this.state.stack.splice(firstIndex, closeCount);

    if (process.env.NODE_ENV === 'development') {
      console.log(
        `[ModalHistory] 关闭前缀 "${prefix}": ${removed.map(e => e.id).join(', ')}`,
        this.getStackIds()
      );
    }

    // 清理浏览器历史
    if (closeCount > 0) {
      this.state.isClosingProgrammatically = true;
      window.history.go(-closeCount);
      setTimeout(() => {
        this.state.isClosingProgrammatically = false;
      }, 50);
    }

    // 如果不跳过 onClose，调用第一个被关闭模态框的 onClose
    if (!skipOnClose && removed.length > 0) {
      removed[0].onClose();
    }
  }

  /**
   * 清空所有模态框并返回根页面
   * 用于页面跳转等需要完全清理历史栈的场景
   */
  clearAndNavigate(): void {
    const closeCount = this.state.stack.length;

    if (closeCount === 0) {
      return;
    }

    if (process.env.NODE_ENV === 'development') {
      console.log(`[ModalHistory] 清空并导航，关闭 ${closeCount} 个模态框`);
    }

    // 清空内部栈
    this.state.stack = [];

    // 清理浏览器历史
    this.state.isClosingProgrammatically = true;
    window.history.go(-closeCount);
    setTimeout(() => {
      this.state.isClosingProgrammatically = false;
    }, 50);
  }

  /**
   * 推入新步骤（用于多步骤表单）
   * @param baseId 模态框基础 ID，如 'bean-form'
   * @param step 步骤号，从 1 开始
   * @param onStepChange 步骤变化回调
   * @param onClose 关闭回调（第一步返回时调用）
   */
  pushStep(
    baseId: string,
    step: number,
    onStepChange: (step: number) => void,
    onClose: () => void
  ): void {
    // 确保已初始化
    if (!this.isInitialized) {
      this.init();
    }

    const stepId = step === 1 ? baseId : `${baseId}-step-${step}`;

    // 检查是否已存在
    const existingIndex = this.state.stack.findIndex(m => m.id === stepId);
    if (existingIndex !== -1) {
      // 已存在，更新回调
      this.state.stack[existingIndex].onStepChange = onStepChange;
      this.state.stack[existingIndex].onClose = onClose;
      return;
    }

    // 添加到栈
    const entry: ModalEntry = {
      id: stepId,
      step,
      onStepChange,
      onClose,
    };
    this.state.stack.push(entry);

    // 添加历史记录
    window.history.pushState({ [HISTORY_STATE_KEY]: stepId }, '');

    if (process.env.NODE_ENV === 'development') {
      console.log(`[ModalHistory] 推入步骤: ${stepId}`, this.getStackIds());
    }
  }

  /**
   * 更新栈顶条目的回调（用于 React 组件重新渲染时更新回调引用）
   */
  updateTopCallbacks(
    onStepChange?: (step: number) => void,
    onClose?: () => void
  ): void {
    const top = this.state.stack[this.state.stack.length - 1];
    if (top) {
      if (onStepChange) top.onStepChange = onStepChange;
      if (onClose) top.onClose = onClose;
    }
  }
}

// 导出单例
export const modalHistory = new ModalHistoryManager();

// 导出类型
export type { ModalHistoryManager };
