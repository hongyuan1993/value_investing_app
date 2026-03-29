-- 两阶段 FCF 增长率：前 5 年与第 6 年及以后可分别保存
-- 在 Supabase SQL Editor 中执行一次即可
alter table public.ticker_analyses
  add column if not exists growth_rate_late double precision;

comment on column public.ticker_analyses.growth_rate_late is
  '预测期第6年及以后的FCF年增长率（小数）；为空时表示与 growth_rate 相同';
