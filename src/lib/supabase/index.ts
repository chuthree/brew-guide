/**
 * Supabase 模块导出
 */

// 旧的复杂同步管理器（保留兼容性）
export { supabaseClient, SupabaseClientWrapper } from './client';
export { supabaseSyncManager, SupabaseSyncManager } from './syncManager';
export {
  SupabaseRealtimeProvider,
  useSupabaseRealtime,
  useSupabaseAutoSync,
} from './SupabaseRealtimeProvider';
export * from './types';

// 新的简化同步服务（推荐使用）
export {
  simpleSyncService,
  type SyncResult,
  type SyncStatus,
} from './simpleSyncService';

/**
 * Supabase 数据库表创建 SQL
 *
 * 用户需要在自己的 Supabase 项目中执行以下 SQL 来创建所需的表：
 *
 * ```sql
 * -- 启用 UUID 扩展（如果尚未启用）
 * CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
 *
 * -- 咖啡豆表
 * CREATE TABLE IF NOT EXISTS coffee_beans (
 *   id TEXT NOT NULL,
 *   user_id TEXT NOT NULL,
 *   data JSONB NOT NULL,
 *   created_at TIMESTAMPTZ DEFAULT NOW(),
 *   updated_at TIMESTAMPTZ DEFAULT NOW(),
 *   deleted_at TIMESTAMPTZ,
 *   version INTEGER DEFAULT 1,
 *   PRIMARY KEY (id, user_id)
 * );
 *
 * -- 冲煮笔记表
 * CREATE TABLE IF NOT EXISTS brewing_notes (
 *   id TEXT NOT NULL,
 *   user_id TEXT NOT NULL,
 *   data JSONB NOT NULL,
 *   created_at TIMESTAMPTZ DEFAULT NOW(),
 *   updated_at TIMESTAMPTZ DEFAULT NOW(),
 *   deleted_at TIMESTAMPTZ,
 *   version INTEGER DEFAULT 1,
 *   PRIMARY KEY (id, user_id)
 * );
 *
 * -- 自定义器具表
 * CREATE TABLE IF NOT EXISTS custom_equipments (
 *   id TEXT NOT NULL,
 *   user_id TEXT NOT NULL,
 *   data JSONB NOT NULL,
 *   created_at TIMESTAMPTZ DEFAULT NOW(),
 *   updated_at TIMESTAMPTZ DEFAULT NOW(),
 *   deleted_at TIMESTAMPTZ,
 *   version INTEGER DEFAULT 1,
 *   PRIMARY KEY (id, user_id)
 * );
 *
 * -- 自定义方案表
 * CREATE TABLE IF NOT EXISTS custom_methods (
 *   id TEXT NOT NULL,
 *   user_id TEXT NOT NULL,
 *   equipment_id TEXT NOT NULL,
 *   data JSONB NOT NULL,
 *   created_at TIMESTAMPTZ DEFAULT NOW(),
 *   updated_at TIMESTAMPTZ DEFAULT NOW(),
 *   deleted_at TIMESTAMPTZ,
 *   version INTEGER DEFAULT 1,
 *   PRIMARY KEY (id, user_id)
 * );
 *
 * -- 用户设置表（存储应用设置、器具排序、自定义预设、磨豆机等）
 * CREATE TABLE IF NOT EXISTS user_settings (
 *   id TEXT NOT NULL,
 *   user_id TEXT NOT NULL,
 *   data JSONB NOT NULL,
 *   created_at TIMESTAMPTZ DEFAULT NOW(),
 *   updated_at TIMESTAMPTZ DEFAULT NOW(),
 *   PRIMARY KEY (id, user_id)
 * );
 *
 * -- 创建索引
 * CREATE INDEX IF NOT EXISTS idx_coffee_beans_user_id ON coffee_beans(user_id);
 * CREATE INDEX IF NOT EXISTS idx_coffee_beans_updated_at ON coffee_beans(updated_at);
 * CREATE INDEX IF NOT EXISTS idx_brewing_notes_user_id ON brewing_notes(user_id);
 * CREATE INDEX IF NOT EXISTS idx_brewing_notes_updated_at ON brewing_notes(updated_at);
 * CREATE INDEX IF NOT EXISTS idx_custom_equipments_user_id ON custom_equipments(user_id);
 * CREATE INDEX IF NOT EXISTS idx_custom_methods_user_id ON custom_methods(user_id);
 * CREATE INDEX IF NOT EXISTS idx_user_settings_user_id ON user_settings(user_id);
 *
 * -- 创建 updated_at 自动更新触发器
 * CREATE OR REPLACE FUNCTION update_updated_at_column()
 * RETURNS TRIGGER AS $$
 * BEGIN
 *   NEW.updated_at = NOW();
 *   RETURN NEW;
 * END;
 * $$ language 'plpgsql';
 *
 * CREATE TRIGGER update_coffee_beans_updated_at
 *   BEFORE UPDATE ON coffee_beans
 *   FOR EACH ROW
 *   EXECUTE FUNCTION update_updated_at_column();
 *
 * CREATE TRIGGER update_brewing_notes_updated_at
 *   BEFORE UPDATE ON brewing_notes
 *   FOR EACH ROW
 *   EXECUTE FUNCTION update_updated_at_column();
 *
 * CREATE TRIGGER update_custom_equipments_updated_at
 *   BEFORE UPDATE ON custom_equipments
 *   FOR EACH ROW
 *   EXECUTE FUNCTION update_updated_at_column();
 *
 * CREATE TRIGGER update_custom_methods_updated_at
 *   BEFORE UPDATE ON custom_methods
 *   FOR EACH ROW
 *   EXECUTE FUNCTION update_updated_at_column();
 *
 * -- 启用 Realtime（实时订阅）
 * ALTER PUBLICATION supabase_realtime ADD TABLE coffee_beans;
 * ALTER PUBLICATION supabase_realtime ADD TABLE brewing_notes;
 * ALTER PUBLICATION supabase_realtime ADD TABLE custom_equipments;
 * ALTER PUBLICATION supabase_realtime ADD TABLE custom_methods;
 *
 * -- RLS 策略（可选，用于数据隔离）
 * ALTER TABLE coffee_beans ENABLE ROW LEVEL SECURITY;
 * ALTER TABLE brewing_notes ENABLE ROW LEVEL SECURITY;
 * ALTER TABLE custom_equipments ENABLE ROW LEVEL SECURITY;
 * ALTER TABLE custom_methods ENABLE ROW LEVEL SECURITY;
 *
 * -- 允许所有用户读写自己的数据（基于 user_id）
 * CREATE POLICY "Users can manage their own coffee_beans"
 *   ON coffee_beans FOR ALL
 *   USING (true)
 *   WITH CHECK (true);
 *
 * CREATE POLICY "Users can manage their own brewing_notes"
 *   ON brewing_notes FOR ALL
 *   USING (true)
 *   WITH CHECK (true);
 *
 * CREATE POLICY "Users can manage their own custom_equipments"
 *   ON custom_equipments FOR ALL
 *   USING (true)
 *   WITH CHECK (true);
 *
 * CREATE POLICY "Users can manage their own custom_methods"
 *   ON custom_methods FOR ALL
 *   USING (true)
 *   WITH CHECK (true);
 * ```
 */
export const SUPABASE_SETUP_SQL = `
-- Brew Guide Supabase 数据库初始化脚本
-- 请在 Supabase SQL Editor 中执行此脚本

-- 启用 UUID 扩展（如果尚未启用）
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

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

-- 用户设置表（存储应用设置、器具排序、自定义预设、磨豆机等）
CREATE TABLE IF NOT EXISTS user_settings (
  id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  data JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (id, user_id)
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_coffee_beans_user_id ON coffee_beans(user_id);
CREATE INDEX IF NOT EXISTS idx_coffee_beans_updated_at ON coffee_beans(updated_at);
CREATE INDEX IF NOT EXISTS idx_brewing_notes_user_id ON brewing_notes(user_id);
CREATE INDEX IF NOT EXISTS idx_brewing_notes_updated_at ON brewing_notes(updated_at);
CREATE INDEX IF NOT EXISTS idx_custom_equipments_user_id ON custom_equipments(user_id);
CREATE INDEX IF NOT EXISTS idx_custom_methods_user_id ON custom_methods(user_id);
CREATE INDEX IF NOT EXISTS idx_user_settings_user_id ON user_settings(user_id);

-- 创建 updated_at 自动更新触发器
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_coffee_beans_updated_at ON coffee_beans;
CREATE TRIGGER update_coffee_beans_updated_at
  BEFORE UPDATE ON coffee_beans
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_brewing_notes_updated_at ON brewing_notes;
CREATE TRIGGER update_brewing_notes_updated_at
  BEFORE UPDATE ON brewing_notes
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_custom_equipments_updated_at ON custom_equipments;
CREATE TRIGGER update_custom_equipments_updated_at
  BEFORE UPDATE ON custom_equipments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_custom_methods_updated_at ON custom_methods;
CREATE TRIGGER update_custom_methods_updated_at
  BEFORE UPDATE ON custom_methods
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_user_settings_updated_at ON user_settings;
CREATE TRIGGER update_user_settings_updated_at
  BEFORE UPDATE ON user_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 启用 Realtime（实时订阅）
-- 注意：需要在 Supabase Dashboard 中启用 Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE coffee_beans;
ALTER PUBLICATION supabase_realtime ADD TABLE brewing_notes;
ALTER PUBLICATION supabase_realtime ADD TABLE custom_equipments;
ALTER PUBLICATION supabase_realtime ADD TABLE custom_methods;
ALTER PUBLICATION supabase_realtime ADD TABLE user_settings;

-- RLS 策略
ALTER TABLE coffee_beans ENABLE ROW LEVEL SECURITY;
ALTER TABLE brewing_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE custom_equipments ENABLE ROW LEVEL SECURITY;
ALTER TABLE custom_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

-- 允许所有操作（开源项目，用户自行管理）
CREATE POLICY "Allow all operations on coffee_beans"
  ON coffee_beans FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow all operations on brewing_notes"
  ON brewing_notes FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow all operations on custom_equipments"
  ON custom_equipments FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow all operations on custom_methods"
  ON custom_methods FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow all operations on user_settings"
  ON user_settings FOR ALL
  USING (true)
  WITH CHECK (true);
`;
