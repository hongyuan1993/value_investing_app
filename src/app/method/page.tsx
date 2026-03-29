import Link from "next/link";
import { ArrowLeft, Calculator } from "lucide-react";

export default function MethodPage() {
  return (
    <div className="min-h-screen">
      <header className="app-header-bar sticky top-0 z-40">
        <div className="mx-auto max-w-3xl px-4 py-5 sm:px-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight text-white sm:text-2xl">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-bloom-accent/15 text-bloom-accent ring-1 ring-bloom-accent/20">
                  <Calculator className="h-5 w-5" />
                </span>
                估值计算说明
              </h1>
              <p className="mt-0.5 text-sm text-bloom-muted">DCF 公式与参数含义</p>
            </div>
            <Link href="/" className="nav-link inline-flex items-center gap-1.5 self-start sm:self-auto">
              <ArrowLeft className="h-4 w-4 opacity-70" />
              返回首页
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-6 px-4 py-10 sm:px-6">
        <section className="app-card p-6 sm:p-7">
          <h2 className="mb-3 text-base font-semibold text-white">1. 思路概述</h2>
          <p className="text-bloom-muted text-sm leading-relaxed">
            本应用采用<strong className="text-white"> 现金流折现法（DCF）</strong>：以公司最近年度的自由现金流（FCF）为基准，按设定增长率预测未来若干年的 FCF，再按折现率（WACC）折现到当前，加上永续增长阶段的终值现值，得到企业价值；除以流通股数即得每股内在价值，与当前股价对比判断高估/低估。
          </p>
        </section>

        <section className="app-card p-6 sm:p-7">
          <h2 className="mb-3 text-base font-semibold text-white">2. 预测期 FCF</h2>
          <p className="text-bloom-muted text-sm mb-2">
            以最近年度 FCF 为 F₀。默认单阶段时每年同一增长率 g；也可将<strong className="text-white">前 5 年</strong>与<strong className="text-white">第 6 年及以后</strong>设为不同年增长率 g₁、g₂（预测年数需大于 5）。
          </p>
          <div className="overflow-x-auto rounded-xl border border-white/[0.06] bg-bloom-bg/50 p-4 font-mono text-sm text-white">
            <p>{'单阶段：FCF_t = F_{t-1} × (1 + g)'}</p>
            <p className="mt-2">两阶段：t ≤ 5 时用 g₁，t &gt; 5 时用 g₂</p>
            <p className="mt-2">PV(FCF_t) = FCF_t / (1 + r)^t</p>
          </div>
          <p className="text-bloom-muted text-xs mt-2">
            r = 折现率（WACC）。预测期共 N 年（本应用 5–10 年）；N ≤ 5 时仅使用 g₁。
          </p>
        </section>

        <section className="app-card p-6 sm:p-7">
          <h2 className="mb-3 text-base font-semibold text-white">3. 终值（Gordon 永续增长模型）</h2>
          <p className="text-bloom-muted text-sm mb-2">预测期结束后，假设 FCF 以永续增长率 g_term 永续增长，终值及现值：</p>
          <div className="overflow-x-auto rounded-xl border border-white/[0.06] bg-bloom-bg/50 p-4 font-mono text-sm text-white">
            <p>FCF_{"{N+1}"} = FCF_N × (1 + g_term)</p>
            <p className="mt-2">TV = FCF_{"{N+1}"} / (r − g_term)</p>
            <p className="mt-2">PV(TV) = TV / (1 + r)^N</p>
          </div>
          <p className="text-bloom-muted text-xs mt-2">
            当 r ≤ g_term 时终值不适用（本应用按 0 处理）。g_term 通常取 1%～3%，不超过长期 GDP 增速。
          </p>
        </section>

        <section className="app-card p-6 sm:p-7">
          <h2 className="mb-3 text-base font-semibold text-white">4. 企业价值与每股内在价值</h2>
          <div className="overflow-x-auto rounded-xl border border-white/[0.06] bg-bloom-bg/50 p-4 font-mono text-sm text-white">
            <p>EV = Σ PV(FCF_t) + PV(TV)</p>
            <p className="mt-2">每股内在价值 = EV / 流通股数</p>
          </div>
        </section>

        <section className="app-card p-6 sm:p-7">
          <h2 className="mb-3 text-base font-semibold text-white">5. 参数来源（本应用）</h2>
          <ul className="text-bloom-muted text-sm space-y-2 list-disc list-inside">
            <li><strong className="text-white">基准 FCF</strong>：财务报表中最近年度的自由现金流（或经营现金流 − 资本支出）。</li>
            <li><strong className="text-white">FCF 增长率</strong>：优先采用分析师「Next 5 Years (per annum)」；若无则用过去 3 年 FCF 年均增长率 × 0.8（保守）。</li>
            <li><strong className="text-white">折现率（WACC）</strong>：有 Beta 时用 无风险利率 + β×股权风险溢价；否则按行业典型 WACC。</li>
            <li><strong className="text-white">永续增长率</strong>：默认 2.5%，可调。</li>
            <li><strong className="text-white">预测年数</strong>：默认 5 年，可调。</li>
          </ul>
        </section>

        <section className="app-card p-6 sm:p-7">
          <h2 className="mb-3 text-base font-semibold text-white">6. 估值指标（P/S、P/E、P/FCF）</h2>
          <p className="text-bloom-muted text-sm mb-3">
            分析股票时，本应用会抓取过去 5 年的以下估值指标并绘制折线图，用于观察估值水平与趋势。指标可与同行业或历史中位数对比，辅助判断高估/低估。
          </p>
          <ul className="text-bloom-muted text-sm space-y-2 list-disc list-inside">
            <li><strong className="text-white">P/S（市销率）</strong> = 市值 / 营收。适用于尚未盈利或利润波动大的公司；越低表示单位营收对应的估值越低。</li>
            <li><strong className="text-white">P/E (GAAP)</strong> = 股价 / 每股收益（GAAP 口径）。即市盈率，反映市场为每单位盈利付出的价格；需结合增速与行业对比。</li>
            <li><strong className="text-white">P/FCF（市现率）</strong> = 市值 / 自由现金流。衡量为获得自由现金流所付代价，与 DCF 思路一致；越低通常表示估值越便宜。</li>
          </ul>
          <p className="text-bloom-muted text-xs mt-2">
            数据来源：Alpha Vantage（EARNINGS、INCOME_STATEMENT、CASH_FLOW、TIME_SERIES_MONTHLY_ADJUSTED 取每年末收盘价）。折线图与 DCF 分析结果均可保存到分析历史中。
          </p>
        </section>

        <section className="app-card p-6 sm:p-7">
          <h2 className="mb-3 text-base font-semibold text-white">7. 与代码对应关系</h2>
          <p className="text-bloom-muted text-sm mb-2">
            上述公式与逻辑实现于 <code className="rounded-md bg-white/[0.06] px-1.5 py-0.5 text-bloom-accent">src/lib/dcf.ts</code> 的 <code className="rounded-md bg-white/[0.06] px-1.5 py-0.5 text-bloom-accent">computeDCF</code>：预测期循环计算 FCF_t 与 PV，终值用 TV = FCF_{"{N+1}"} / (r − g_term)，再折现到当前；EV = pvProjectedFcf + pvTerminalValue，每股内在价值 = EV / sharesOutstanding。
          </p>
        </section>
      </main>
    </div>
  );
}
