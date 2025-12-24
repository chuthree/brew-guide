/**
 * Supabase 数据库初始化 SQL 脚本
 *
 * 用户需要在 Supabase SQL Editor 中执行此脚本来创建所需的表结构。
 *
 * 同步策略说明（基于 CouchDB Tombstone 模式）：
 * - 所有数据表都有 deleted_at 字段用于软删除
 * - 上传时：本地不存在但云端存在的记录会被标记 deleted_at
 * - 下载时：只获取 deleted_at IS NULL 的记录
 * - 软删除的数据不会被物理删除，可以通过 SQL 查询历史数据
 */

export const SUPABASE_SETUP_SQL = `-- Brew Guide Supabase 数据库初始化脚本
-- 版本: 2.0.0 (2025-12-22 更新)
-- 支持软删除同步策略

-- ==================== 表结构 ====================

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

-- 自定义方案表（id = equipmentId，每个器具一个方案集合）
CREATE TABLE IF NOT EXISTS custom_methods (
  id TEXT NOT NULL,
  user_id TEXT NOT NULL,
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

-- ==================== 索引 ====================

CREATE INDEX IF NOT EXISTS idx_coffee_beans_user_id ON coffee_beans(user_id);
CREATE INDEX IF NOT EXISTS idx_coffee_beans_active ON coffee_beans(user_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_brewing_notes_user_id ON brewing_notes(user_id);
CREATE INDEX IF NOT EXISTS idx_brewing_notes_active ON brewing_notes(user_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_custom_equipments_user_id ON custom_equipments(user_id);
CREATE INDEX IF NOT EXISTS idx_custom_equipments_active ON custom_equipments(user_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_custom_methods_user_id ON custom_methods(user_id);
CREATE INDEX IF NOT EXISTS idx_custom_methods_active ON custom_methods(user_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_user_settings_user_id ON user_settings(user_id);

-- ==================== RLS 策略 ====================

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

-- ==================== Realtime 实时同步配置 ====================

DROP PUBLICATION IF EXISTS supabase_realtime;

CREATE PUBLICATION supabase_realtime FOR TABLE 
  coffee_beans,
  brewing_notes,
  custom_equipments,
  custom_methods,
  user_settings;

-- 设置 replica identity 为 FULL，确保 UPDATE/DELETE 事件包含完整数据
ALTER TABLE coffee_beans REPLICA IDENTITY FULL;
ALTER TABLE brewing_notes REPLICA IDENTITY FULL;
ALTER TABLE custom_equipments REPLICA IDENTITY FULL;
ALTER TABLE custom_methods REPLICA IDENTITY FULL;
ALTER TABLE user_settings REPLICA IDENTITY FULL;
`;
