/**
 * Supabase 同步相关的类型定义
 *
 * 2025-12-21 简化：只保留手动上传/下载所需的类型
 */

import type { CoffeeBean } from '@/types/app';
import type { BrewingNote, CustomEquipment, Method } from '@/lib/core/config';

/**
 * Supabase 配置
 */
export interface SupabaseConfig {
  /** Supabase 项目 URL */
  url: string;
  /** Supabase anon key（公开密钥） */
  anonKey: string;
}

/**
 * Supabase 同步设置（存储在本地设置中）
 */
export interface SupabaseSyncSettings {
  /** 是否启用 */
  enabled: boolean;
  /** Supabase 项目 URL */
  url: string;
  /** Supabase anon key */
  anonKey: string;
  /** 上次连接是否成功 */
  lastConnectionSuccess?: boolean;
  /** 上次同步时间 */
  lastSyncTime?: number;
}

/**
 * Supabase 数据库表名
 */
export type SupabaseTableName =
  | 'coffee_beans'
  | 'brewing_notes'
  | 'custom_equipments'
  | 'custom_methods'
  | 'user_settings';

/**
 * Supabase 表数据类型 - 咖啡豆
 */
export interface SupabaseCoffeeBean {
  id: string;
  user_id: string;
  data: CoffeeBean;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
  version: number;
}

/**
 * Supabase 表数据类型 - 冲煮笔记
 */
export interface SupabaseBrewingNote {
  id: string;
  user_id: string;
  data: BrewingNote;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
  version: number;
}

/**
 * Supabase 表数据类型 - 自定义器具
 */
export interface SupabaseCustomEquipment {
  id: string;
  user_id: string;
  data: CustomEquipment;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
  version: number;
}

/**
 * Supabase 表数据类型 - 自定义方案
 * 注意：id 就是 equipmentId，每个器具只有一个方案集合
 */
export interface SupabaseCustomMethod {
  id: string; // 等于 equipmentId
  user_id: string;
  data: { equipmentId: string; methods: Method[] };
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
  version: number;
}

/**
 * 用户设置
 */
export interface SupabaseUserSettings {
  id: string;
  user_id: string;
  data: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}
