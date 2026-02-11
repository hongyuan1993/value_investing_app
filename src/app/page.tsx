"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import Link from "next/link";
import { TickerSearch } from "@/components/TickerSearch";
import { QuoteCard } from "@/components/QuoteCard";
import { DCFParams, type DCFParamValues } from "@/components/DCFParams";
import { ValuationGauge } from "@/components/ValuationGauge";
import { ValuationChart } from "@/components/ValuationChart";
import { computeDCF, conservativeGrowthFromHistory } from "@/lib/dcf";
import type { TickerData, FCFEntry } from "@/lib/types";
import { AlertCircle, Loader2, Save, Sparkles, Check } from "lucide-react";

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
      const saved = tickerData.savedDcfParams;
      if (saved && Number.isFinite(saved.growthRate) && Number.isFinite(saved.discountRate) && Number.isFinite(saved.terminalGrowthRate) && Number.isFinite(saved.projectionYears)) {
        setGrowthRateSource("已保存的分析参数");
        setParams({
          growthRate: saved.growthRate,
          discountRate: saved.discountRate,
          terminalGrowthRate: saved.terminalGrowthRate,
          projectionYears: saved.projectionYears,
        });
      } else {
        const fcfHistory = tickerData.fcfHistory ?? [];
        const fcfValues = fcfHistory
          .map((e: FCFEntry) => e.freeCashflow)
          .filter((v): v is number => v != null && Number.isFinite(v));
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
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "网络错误");
    } finally {
      setLoading(false);
    }
  }, []);

  // 支持 URL ?symbol=XXX 自动分析
  useEffect(() => {
    if (typeof window === "undefined") return;
    const q = new URLSearchParams(window.location.search).get("symbol")?.trim().toUpperCase();
    if (q) fetchTicker(q);
  }, [fetchTicker]);

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

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const handleSave = useCallback(async () => {
    if (!data || !dcfResult || !hasFCF) return;
    setSaving(true);
    setSaved(false);
    try {
      const res = await fetch("/api/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          symbol: data.quote.symbol ?? symbol,
          quote: data.quote,
          fcfHistory: data.fcfHistory,
          analystGrowthRate5y: data.analystGrowthRate5y,
          suggestedWacc: data.suggestedWacc,
          waccSource: data.waccSource,
          valuationMetrics: data.valuationMetrics,
          growthRate: params.growthRate,
          discountRate: params.discountRate,
          terminalGrowthRate: params.terminalGrowthRate,
          projectionYears: params.projectionYears,
          intrinsicValuePerShare: dcfResult.intrinsicValuePerShare,
          currentPrice: data.quote.regularMarketPrice ?? 0,
        }),
      });
      const json = await res.json();
      if (res.ok) setSaved(true);
      else alert(json?.error ?? "保存失败");
    } catch (e) {
      alert(e instanceof Error ? e.message : "保存失败");
    } finally {
      setSaving(false);
    }
  }, [data, dcfResult, hasFCF, params, symbol]);

  const [adviceLoading, setAdviceLoading] = useState(false);
  const [advice, setAdvice] = useState<{
    growthRate: number;
    discountRate: number;
    terminalGrowthRate: number;
    projectionYears: number;
    reasoning: string;
  } | null>(null);
  const [adviceError, setAdviceError] = useState<string | null>(null);

  const fetchAdvice = useCallback(async () => {
    if (!data || !hasFCF) return;
    setAdviceLoading(true);
    setAdviceError(null);
    setAdvice(null);
    try {
      const res = await fetch("/api/dcf-advice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          symbol: data.quote.symbol ?? symbol,
          quote: data.quote,
          fcfHistory: data.fcfHistory,
          analystGrowthRate5y: data.analystGrowthRate5y,
          suggestedWacc: data.suggestedWacc,
          waccSource: data.waccSource,
          currentParams: params,
        }),
      });
      const json = await res.json();
      if (res.ok) {
        setAdvice(json);
      } else {
        setAdviceError(json?.error ?? "获取失败");
      }
    } catch (e) {
      setAdviceError(e instanceof Error ? e.message : "网络错误");
    } finally {
      setAdviceLoading(false);
    }
  }, [data, hasFCF, params, symbol]);

  const applyAdvice = useCallback(() => {
    if (!advice) return;
    setParams({
      growthRate: advice.growthRate,
      discountRate: advice.discountRate,
      terminalGrowthRate: advice.terminalGrowthRate,
      projectionYears: advice.projectionYears,
    });
  }, [advice]);

  return (
    <div className="min-h-screen bg-bloom-bg">
      <header className="border-b border-bloom-border bg-bloom-surface/80 backdrop-blur">
        <div className="max-w-5xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-lg font-semibold text-white">DCF 内在价值</h1>
            <div className="flex items-center gap-4">
              <Link
                href="/method"
                className="text-sm text-bloom-muted hover:text-white transition-colors"
              >
                估值方法
              </Link>
              <Link
                href="/saved"
                className="text-sm text-bloom-muted hover:text-white transition-colors"
              >
                分析历史
              </Link>
            </div>
          </div>
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

            {data.valuationMetrics && data.valuationMetrics.length > 0 && (
              <ValuationChart data={data.valuationMetrics} />
            )}
            {data && (!data.valuationMetrics || data.valuationMetrics.length === 0) && (
              <p className="text-xs text-bloom-muted rounded-xl border border-bloom-border bg-bloom-surface/50 px-4 py-3">
                暂无估值指标折线图（需使用 Alpha Vantage 抓取）。在「分析历史」中对该股票点击「更新」可重新抓取并显示 P/S、P/E、P/FCF 走势。
              </p>
            )}

            {hasFCF && (
              <>
                <div className="rounded-xl border border-bloom-border bg-bloom-surface p-5">
                  <h3 className="text-sm font-semibold text-white uppercase tracking-wider mb-3 flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-bloom-amber" />
                    DCF 参数专家意见
                  </h3>
                  <p className="text-xs text-bloom-muted mb-3">由 Gemini 大模型根据公司数据给出参数建议，仅供参考。</p>
                  <div className="flex flex-wrap gap-3">
                    <button
                      onClick={fetchAdvice}
                      disabled={adviceLoading}
                      className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium bg-bloom-amber/20 text-bloom-amber hover:bg-bloom-amber/30 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {adviceLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                      {adviceLoading ? "获取中…" : "获取专家意见"}
                    </button>
                    {advice && (
                      <button
                        onClick={applyAdvice}
                        className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium bg-bloom-green/20 text-bloom-green hover:bg-bloom-green/30"
                      >
                        <Check className="h-4 w-4" />
                        采用建议
                      </button>
                    )}
                  </div>
                  {adviceError && (
                    <p className="mt-3 text-sm text-bloom-red">{adviceError}</p>
                  )}
                  {advice && (
                    <div className="mt-4 space-y-2 text-sm">
                      <p className="text-bloom-muted">{advice.reasoning}</p>
                      <p className="text-bloom-muted">
                        建议参数：增长率 {(advice.growthRate * 100).toFixed(1)}%，折现率 {(advice.discountRate * 100).toFixed(1)}%，永续增长率 {(advice.terminalGrowthRate * 100).toFixed(1)}%，预测 {advice.projectionYears} 年
                      </p>
                    </div>
                  )}
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                  <DCFParams
                    values={params}
                    onChange={setParams}
                    disabled={false}
                    growthRateSource={growthRateSource}
                    waccSource={data?.waccSource ?? null}
                  />
                  <div className="space-y-4">
                    <ValuationGauge
                      currentPrice={data.quote.regularMarketPrice ?? 0}
                      intrinsicValue={dcfResult?.intrinsicValuePerShare ?? 0}
                      currency={data.quote.currency}
                    />
                    <button
                      onClick={handleSave}
                      disabled={saving || !dcfResult}
                      className="w-full inline-flex items-center justify-center gap-2 rounded-lg py-3 px-4 text-sm font-medium bg-bloom-accent/20 text-bloom-accent hover:bg-bloom-accent/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {saving ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : saved ? (
                        "已保存"
                      ) : (
                        <>
                          <Save className="h-4 w-4" />
                          保存分析
                        </>
                      )}
                    </button>
                  </div>
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
