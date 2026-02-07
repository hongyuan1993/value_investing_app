"use client";

import { useState, useCallback, useMemo } from "react";
import { TickerSearch } from "@/components/TickerSearch";
import { QuoteCard } from "@/components/QuoteCard";
import { DCFParams, type DCFParamValues } from "@/components/DCFParams";
import { ValuationGauge } from "@/components/ValuationGauge";
import { computeDCF, conservativeGrowthFromHistory } from "@/lib/dcf";
import type { TickerData, FCFEntry } from "@/lib/types";
import { AlertCircle, Loader2 } from "lucide-react";

export default function Home() {
  const [symbol, setSymbol] = useState("");
  const [data, setData] = useState<TickerData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [params, setParams] = useState<DCFParamValues>({
    growthRate: 0.10,
    discountRate: 0.10,
    terminalGrowthRate: 0.025,
    projectionYears: 5,
  });
  /** FCF 增长率初值来源说明（用于在分析结果中展示计算过程） */
  const [growthRateSource, setGrowthRateSource] = useState<string | null>(null);

  const fetchTicker = useCallback(async (s: string) => {
    setSymbol(s);
    setLoading(true);
    setError(null);
    setData(null);
    setGrowthRateSource(null);
    try {
      const res = await fetch(`/api/ticker/${encodeURIComponent(s)}`);
      const text = await res.text();
      let json: unknown;
      try {
        json = JSON.parse(text);
      } catch {
        setError("服务器返回了无效响应，请稍后重试。");
        return;
      }
      if (!res.ok) {
        const err = json && typeof json === "object" && "error" in json ? (json as { error: string }).error : "请求失败";
        setError(err);
        return;
      }
      const tickerData = json as TickerData;
      setData(tickerData);
      const fcfHistory = tickerData.fcfHistory ?? [];
      const fcfValues = fcfHistory
        .map((e: FCFEntry) => e.freeCashflow)
        .filter((v): v is number => v != null && Number.isFinite(v));
      // 1) 优先使用分析师 "Next 5 Years (per annum)" 增长率
      // 2) 若无则用过去 3 年 FCF 平均增长率 × 0.8（保守）
      let initialGrowth: number | null = null;
      let sourceText: string | null = null;
      if (tickerData.analystGrowthRate5y != null && Number.isFinite(tickerData.analystGrowthRate5y)) {
        initialGrowth = tickerData.analystGrowthRate5y;
        sourceText = `分析师 Next 5 Years (per annum) ${(tickerData.analystGrowthRate5y * 100).toFixed(1)}%`;
      }
      if (initialGrowth == null) {
        initialGrowth = conservativeGrowthFromHistory(fcfValues, 3, 0.8);
        if (initialGrowth != null) {
          const cagr3y = initialGrowth / 0.8;
          sourceText = `过去 3 年 FCF 年均增长率 ${(cagr3y * 100).toFixed(1)}% × 0.8 ≈ ${(initialGrowth * 100).toFixed(1)}%`;
        }
      }
      if (initialGrowth == null) sourceText = "默认 10%";
      setGrowthRateSource(sourceText);
      const suggestedWacc = tickerData.suggestedWacc;
      const hasWacc = suggestedWacc != null && Number.isFinite(suggestedWacc) && suggestedWacc >= 0.05 && suggestedWacc <= 0.25;
      setParams((prev) => ({
        ...prev,
        growthRate: initialGrowth != null && initialGrowth > 0 ? initialGrowth : prev.growthRate,
        discountRate: hasWacc ? suggestedWacc : prev.discountRate,
      }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "网络错误");
    } finally {
      setLoading(false);
    }
  }, []);

  const dcfResult = useMemo(() => {
    if (!data?.quote || !data?.fcfHistory?.length) return null;
    const latestFcf = data.fcfHistory[0]?.freeCashflow;
    if (latestFcf == null || !Number.isFinite(latestFcf) || latestFcf <= 0) return null;
    const shares = data.quote.sharesOutstanding ?? 0;
    if (!shares || shares <= 0) return null;
    return computeDCF({
      baseFcf: latestFcf,
      projectionYears: params.projectionYears,
      growthRate: params.growthRate,
      discountRate: params.discountRate,
      terminalGrowthRate: params.terminalGrowthRate,
      sharesOutstanding: shares,
    });
  }, [data, params]);

  const hasFCF = data?.fcfHistory?.length && data.fcfHistory.some((e) => e.freeCashflow != null && e.freeCashflow > 0);
  const noFCFWarning = data && !hasFCF;

  return (
    <div className="min-h-screen bg-bloom-bg">
      <header className="border-b border-bloom-border bg-bloom-surface/80 backdrop-blur">
        <div className="max-w-5xl mx-auto px-4 py-4">
          <h1 className="text-lg font-semibold text-white mb-4">DCF 内在价值</h1>
          <TickerSearch onSearch={fetchTicker} loading={loading} />
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        {loading && (
          <div className="flex items-center justify-center py-12 text-bloom-muted">
            <Loader2 className="h-8 w-8 animate-spin mr-2" />
            加载中…
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 rounded-lg border border-bloom-red/50 bg-bloom-red/10 text-bloom-red px-4 py-3">
            <AlertCircle className="h-5 w-5 shrink-0" />
            <p>{error}</p>
          </div>
        )}

        {noFCFWarning && !loading && (
          <div className="flex items-center gap-2 rounded-lg border border-bloom-amber/50 bg-bloom-amber/10 text-bloom-amber px-4 py-3">
            <AlertCircle className="h-5 w-5 shrink-0" />
            <p>该标的暂无或缺少自由现金流数据，无法计算 DCF 估值。</p>
          </div>
        )}

        {data && !loading && (
          <>
            <QuoteCard quote={data.quote} />

            {hasFCF && (
              <>
                <div className="grid md:grid-cols-2 gap-6">
                  <DCFParams
                    values={params}
                    onChange={setParams}
                    disabled={false}
                    growthRateSource={growthRateSource}
                    waccSource={data?.waccSource ?? null}
                  />
                  <ValuationGauge
                    currentPrice={data.quote.regularMarketPrice ?? 0}
                    intrinsicValue={dcfResult?.intrinsicValuePerShare ?? 0}
                    currency={data.quote.currency}
                  />
                </div>

                {dcfResult && (
                  <div className="rounded-xl border border-bloom-border bg-bloom-surface p-5">
                    <h3 className="text-sm font-semibold text-white uppercase tracking-wider mb-3">DCF 汇总</h3>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                      <div>
                        <p className="text-bloom-muted">预测期 FCF 现值（{params.projectionYears} 年）</p>
                        <p className="font-mono text-white">${(dcfResult.pvProjectedFcf / 1e9).toFixed(2)}B</p>
                      </div>
                      <div>
                        <p className="text-bloom-muted">终值现值</p>
                        <p className="font-mono text-white">${(dcfResult.pvTerminalValue / 1e9).toFixed(2)}B</p>
                      </div>
                      <div>
                        <p className="text-bloom-muted">企业价值</p>
                        <p className="font-mono text-white">${(dcfResult.enterpriseValue / 1e9).toFixed(2)}B</p>
                      </div>
                      <div>
                        <p className="text-bloom-muted">基准 FCF（最近年度）</p>
                        <p className="font-mono text-white">${((data.fcfHistory[0]?.freeCashflow ?? 0) / 1e9).toFixed(2)}B</p>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </>
        )}

        {!data && !loading && !error && (
          <div className="text-center py-16 text-bloom-muted">
            <p>输入美股代码（如 AAPL、TSLA）查看行情与 DCF 估值。</p>
          </div>
        )}
      </main>
    </div>
  );
}
