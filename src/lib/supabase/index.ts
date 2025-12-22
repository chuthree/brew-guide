/**
 * Supabase 模块导出
 */

export { SupabaseSyncManager } from './SupabaseSyncManager';
export type { SyncResult, SyncStatus } from './simpleSyncService';

// 保留旧版 API 以保持向后兼容
export {
  simpleSyncService,
  initializeSupabase,
  testConnection,
  uploadAllData,
  downloadAllData,
  disconnectSupabase,
  isSupabaseInitialized,
} from './simpleSyncService';

// 类型导出
export * from './types';

/**
 * Supabase 数据库初始化 SQL
 * 用户需要在 Supabase SQL Editor 中执行此脚本
 */
export const SUPABASE_SETUP_SQL = `-- Brew Guide Supabase 数据库初始化脚本

-- 咖啡豆表
CREATE TABLE IF NOT EXISTS coffee_beans (
  id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  data JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  version INTEGER DEFAULT 1,
  PRIMARY KEY (id, user_id)
);

-- 冲煮笔记表
CREATE TABLE IF NOT EXISTS brewing_notes (
  id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  data JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  version INTEGER DEFAULT 1,
  PRIMARY KEY (id, user_id)
);

-- 自定义器具表
CREATE TABLE IF NOT EXISTS custom_equipments (
  id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  data JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  version INTEGER DEFAULT 1,
  PRIMARY KEY (id, user_id)
);

-- 自定义方案表
CREATE TABLE IF NOT EXISTS custom_methods (
  id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  equipment_id TEXT NOT NULL,
  data JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  version INTEGER DEFAULT 1,
  PRIMARY KEY (id, user_id)
);

-- 用户设置表
CREATE TABLE IF NOT EXISTS user_settings (
  id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  data JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (id, user_id)
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_coffee_beans_user_id ON coffee_beans(user_id);
CREATE INDEX IF NOT EXISTS idx_brewing_notes_user_id ON brewing_notes(user_id);
CREATE INDEX IF NOT EXISTS idx_custom_equipments_user_id ON custom_equipments(user_id);
CREATE INDEX IF NOT EXISTS idx_custom_methods_user_id ON custom_methods(user_id);
CREATE INDEX IF NOT EXISTS idx_user_settings_user_id ON user_settings(user_id);

-- RLS 策略（可选）
ALTER TABLE coffee_beans ENABLE ROW LEVEL SECURITY;
ALTER TABLE brewing_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE custom_equipments ENABLE ROW LEVEL SECURITY;
ALTER TABLE custom_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all on coffee_beans" ON coffee_beans FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on brewing_notes" ON brewing_notes FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on custom_equipments" ON custom_equipments FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on custom_methods" ON custom_methods FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on user_settings" ON user_settings FOR ALL USING (true) WITH CHECK (true);
`;
