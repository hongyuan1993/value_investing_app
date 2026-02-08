# Supabase 数据库搭建说明

## 1. 创建 Supabase 项目

1. 打开 [https://supabase.com](https://supabase.com) 并登录
2. 点击 **New Project**
3. 填写项目名称、数据库密码，选择区域
4. 点击 **Create new project** 等待创建完成

## 2. 获取连接信息

项目创建后：

1. 进入项目，左侧点击 **Project Settings**（齿轮图标）
2. 在 **API** 页面找到：
   - **Project URL**（`https://xxx.supabase.co`）
   - **anon** 公钥（Publishable Key，可安全暴露给客户端）

## 3. 配置环境变量

在项目根目录的 `.env.local` 中添加：

```
NEXT_PUBLIC_SUPABASE_URL=你的Project URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=你的anon公钥
```

## 4. 执行 SQL 建表

在 Supabase 控制台左侧点击 **SQL Editor**，新建查询，粘贴以下 SQL 并执行：

```sql
-- 分析结果缓存表：按股票代码存一份，支持后续更新
CREATE TABLE IF NOT EXISTS ticker_analyses (
  symbol TEXT PRIMARY KEY,
  quote JSONB NOT NULL,
  fcf_history JSONB NOT NULL DEFAULT '[]',
  analyst_growth_rate_5y DOUBLE PRECISION,
  suggested_wacc DOUBLE PRECISION,
  wacc_source TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 索引：按更新时间倒序，方便历史页展示
CREATE INDEX IF NOT EXISTS idx_ticker_analyses_updated_at
  ON ticker_analyses (updated_at DESC);

-- 更新时自动刷新 updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_ticker_analyses_updated_at ON ticker_analyses;
CREATE TRIGGER trigger_ticker_analyses_updated_at
  BEFORE UPDATE ON ticker_analyses
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- 使用 anon 公钥时需关闭 RLS，或添加策略允许访问（本表为个人缓存，无多租户需求）
ALTER TABLE ticker_analyses DISABLE ROW LEVEL SECURITY;
```

> **注意**：若触发器报错 `EXECUTE FUNCTION` 不存在，可改为 `EXECUTE PROCEDURE update_updated_at()`，或直接删除该触发器，应用层会自行更新 `updated_at`。

## 5. 验证

- 在 **Table Editor** 中应能看到 `ticker_analyses` 表
- 在应用中点「分析」某股票后，该表会插入或更新对应行
- 在「分析历史」页面可查看已保存的结果，并可对单只股票点击「更新」重新抓取数据
