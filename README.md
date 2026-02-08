# DCF 估值 — 内在价值计算器

基于 **现金流折现法（DCF）** 查询美股并估算 **内在价值** 的 Web 应用。深色仪表盘风格界面，参考 Bloomberg / TradingView。

## 技术栈

- **框架：** Next.js 15（App Router）
- **样式：** Tailwind CSS、Lucide React
- **数据：** Alpha Vantage（需免费 API Key）或 Yahoo Finance 备用

## 功能

- **股票代码搜索：** 输入美股代码（如 AAPL、TSLA）加载行情与财务数据。
- **行情与指标：** 当前股价、市值、市盈率（TTM / 预期）、流通股数。
- **DCF 计算：** 以最近年度自由现金流（FCF）为基础，预测 5–10 年、终值，结合 WACC 与永续增长率计算估值。
- **可调参数：** 通过滑块调整 FCF 增长率、折现率（WACC）、永续增长率、预测年数，结果实时更新。
- **估值展示：** 仪表条展示高估 / 合理 / 低估及每股内在价值。

## 快速开始

```bash
npm install
npm run dev
```

浏览器打开 [http://localhost:3000](http://localhost:3000)，输入股票代码，并用滑块微调 DCF 参数。

## 环境变量

### Alpha Vantage（行情与 FCF，推荐）

1. 在 [Alpha Vantage — API Key](https://www.alphavantage.co/support/#api-key) 申请 Key。
2. 在 `.env.local` 中添加：`ALPHA_VANTAGE_API_KEY=你的key`

未配置 Key 时，应用会回退到 Yahoo Finance；在很多环境下 Yahoo 可能无数据，会提示 **「未找到行情」**。

### Supabase（分析结果缓存与历史）

分析功能会优先从 Supabase 读取已缓存数据；若无则从网上抓取并自动保存。

1. 在 [Supabase](https://supabase.com) 创建项目。
2. 按 [SUPABASE_SETUP.md](./SUPABASE_SETUP.md) 执行 SQL 建表。
3. 在 `.env.local` 中添加：
   ```
   NEXT_PUBLIC_SUPABASE_URL=你的Project URL
   NEXT_PUBLIC_SUPABASE_ANON_KEY=你的anon公钥
   ```

未配置 Supabase 时，分析仍会工作，但不会缓存，且「分析历史」页面不可用。

### Gemini（DCF 参数专家意见）

DCF 参数可基于 Gemini 大模型给出建议。

1. 在 [Google AI Studio](https://aistudio.google.com/app/apikey) 申请 API Key。
2. 在 `.env.local` 中添加：`GEMINI_API_KEY=你的key`

未配置时，「获取专家意见」按钮不可用或会提示配置。

## 数据与限制

- **配置 ALPHA_VANTAGE_API_KEY 后：** 行情（GLOBAL_QUOTE）、公司概览与年度现金流（用于 FCF）来自 Alpha Vantage。免费档有请求限制（如每日 25 次）。
- **未配置 Key：** 会尝试 Yahoo Finance v7 quote 与 v10 quoteSummary，可能因 Cookie 限制而失败。
- 缺失或无效数据（如无 FCF、无股数）会以明确提示处理。

## DCF 计算逻辑（简述）

1. 以 **最近年度 FCF** 为基准。
2. 按设定的 **增长率** 预测未来 **N 年**（默认 5 年）的 FCF。
3. 用 **折现率（WACC）** 将各年 FCF 折现到当前。
4. 按 **永续增长率** 计算 **终值** 并折现到当前。
5. **企业价值** = 预测期 FCF 现值之和 + 终值现值。
6. **每股内在价值** = 企业价值 / 流通股数。
7. 与当前股价对比，展示高估 / 合理 / 低估。

## 许可证

MIT
