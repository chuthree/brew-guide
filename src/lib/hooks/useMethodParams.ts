/**
 * 统一的方案参数管理 Hook
 *
 * 职责：
 * 1. 管理方案参数的获取、合并、更新逻辑
 * 2. 区分参数来源（方案默认、笔记保存、用户修改、空占位）
 * 3. 提供清晰的参数优先级策略
 *
 * 参数优先级：
 * 用户修改 > 笔记保存 > 设置覆盖 > 方案默认值
 */

import { useState, useCallback, useMemo } from 'react';
import type { Method } from '@/lib/core/config';

export type ParamSource =
  | 'method-default' // 方案默认值
  | 'note-saved' // 笔记保存的参数
  | 'user-modified' // 用户修改的参数
  | 'empty-placeholder' // 空占位符（快捷记录）
  | 'settings-override'; // 设置覆盖

export interface MethodParams {
  coffee?: string;
  water?: string;
  ratio?: string;
  grindSize?: string;
  temp?: string;
  stages?: Method['params']['stages'];
}

export interface MethodParamsWithSource extends MethodParams {
  _source?: ParamSource;
}

/**
 * 检查参数是否为空占位符（快捷记录）
 * 空占位符：只有 coffee 字段有值，其他字段为空字符串
 *
 * 注意：快捷记录的 coffee 值应该被保留，只是其他参数需要使用方案默认值
 */
export function isEmptyPlaceholder(params?: Partial<MethodParams>): boolean {
  if (!params) return true;

  const { coffee, water, ratio, grindSize, temp } = params;

  // 如果 coffee 有值，但其他字段都是空的，认为是空占位符
  const hasOnlyCoffee = !!coffee && !water && !ratio && !grindSize && !temp;

  return hasOnlyCoffee;
}

/**
 * 从空占位符中提取有效的 coffee 值
 */
export function extractCoffeeFromPlaceholder(
  params?: Partial<MethodParams>
): string | undefined {
  if (!params || !isEmptyPlaceholder(params)) return undefined;
  return params.coffee;
}

/**
 * 检查参数是否有效（至少有一个非空字段）
 */
export function hasValidParams(params?: Partial<MethodParams>): boolean {
  if (!params) return false;

  const { coffee, water, ratio, grindSize, temp } = params;

  return !!(coffee || water || ratio || grindSize || temp);
}

/**
 * 合并方案参数
 *
 * @param methodDefaults - 方案默认参数
 * @param savedParams - 笔记保存的参数
 * @param userModified - 用户修改的参数
 * @returns 合并后的参数
 */
export function mergeMethodParams(
  methodDefaults: MethodParams,
  savedParams?: Partial<MethodParams>,
  userModified?: Partial<MethodParams>
): MethodParamsWithSource {
  // 优先级：用户修改 > 笔记保存 > 方案默认

  // 如果笔记保存的参数是空占位符（快捷记录），提取 coffee 值，其他使用方案默认值
  const isPlaceholder = isEmptyPlaceholder(savedParams);
  const placeholderCoffee = isPlaceholder
    ? extractCoffeeFromPlaceholder(savedParams)
    : undefined;

  const effectiveSavedParams = isPlaceholder ? undefined : savedParams;

  const merged: MethodParamsWithSource = {
    // coffee: 优先用户修改 > 空占位符的 coffee > 笔记保存 > 方案默认
    coffee:
      userModified?.coffee ??
      placeholderCoffee ??
      effectiveSavedParams?.coffee ??
      methodDefaults.coffee,
    water:
      userModified?.water ??
      effectiveSavedParams?.water ??
      methodDefaults.water,
    ratio:
      userModified?.ratio ??
      effectiveSavedParams?.ratio ??
      methodDefaults.ratio,
    grindSize:
      userModified?.grindSize ??
      effectiveSavedParams?.grindSize ??
      methodDefaults.grindSize,
    temp:
      userModified?.temp ?? effectiveSavedParams?.temp ?? methodDefaults.temp,
    stages:
      userModified?.stages ??
      effectiveSavedParams?.stages ??
      methodDefaults.stages,
  };

  // 标记参数来源
  if (userModified && hasValidParams(userModified)) {
    merged._source = 'user-modified';
  } else if (effectiveSavedParams && hasValidParams(effectiveSavedParams)) {
    merged._source = 'note-saved';
  } else if (isPlaceholder) {
    merged._source = 'empty-placeholder';
  } else {
    merged._source = 'method-default';
  }

  return merged;
}

interface UseMethodParamsOptions {
  /** 当前选中的方案 */
  method?: Method | null;
  /** 笔记保存的参数（编辑模式） */
  savedParams?: Partial<MethodParams>;
  /** 是否是快捷记录 */
  isQuickNote?: boolean;
}

export function useMethodParams(options: UseMethodParamsOptions) {
  const { method, savedParams, isQuickNote } = options;

  // 用户修改的参数（最高优先级）
  const [userModifiedParams, setUserModifiedParams] = useState<
    Partial<MethodParams> | undefined
  >();

  // 计算有效参数
  const effectiveParams = useMemo(() => {
    if (!method) return null;

    // 如果是快捷记录，忽略 savedParams
    const effectiveSavedParams = isQuickNote ? undefined : savedParams;

    return mergeMethodParams(
      method.params,
      effectiveSavedParams,
      userModifiedParams
    );
  }, [method, savedParams, isQuickNote, userModifiedParams]);

  // 更新参数
  const updateParams = useCallback((newParams: Partial<MethodParams>) => {
    setUserModifiedParams(prev => ({
      ...prev,
      ...newParams,
    }));
  }, []);

  // 重置为方案默认值
  const resetToDefaults = useCallback(() => {
    setUserModifiedParams(undefined);
  }, []);

  // 重置为笔记保存的值
  const resetToSaved = useCallback(() => {
    setUserModifiedParams(undefined);
  }, []);

  return {
    /** 当前有效的参数 */
    params: effectiveParams,
    /** 参数来源 */
    source: effectiveParams?._source,
    /** 更新参数 */
    updateParams,
    /** 重置为方案默认值 */
    resetToDefaults,
    /** 重置为笔记保存的值 */
    resetToSaved,
    /** 是否有用户修改 */
    hasUserModifications:
      !!userModifiedParams && hasValidParams(userModifiedParams),
  };
}
