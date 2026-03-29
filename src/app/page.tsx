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
    growthRateLate: 0.10,
    discountRate: 0.10,
    terminalGrowthRate: 0.025,
    projectionYears: 5,
  });
  /** FCF 增长率初值来源说明（用于在分析结果中展示计算过程） */
  const [growthRateSource, setGrowthRateSource] = useState<string | null>(null);

  const fetchTicker = useCallback(async (s: string, cacheOnly?: boolean) => {
    setSymbol(s);
    setLoading(true);
    setError(null);
    setData(null);
    setGrowthRateSource(null);
    try {
      const url = `/api/ticker/${encodeURIComponent(s)}${cacheOnly ? "?cacheOnly=1" : ""}`;
      const res = await fetch(url);
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
        const late = saved.growthRateLate ?? saved.growthRate;
        setParams({
          growthRate: saved.growthRate,
          growthRateLate: late,
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
        const g = initialGrowth != null && initialGrowth > 0 ? initialGrowth : undefined;
        setParams((prev) => ({
          ...prev,
          growthRate: g ?? prev.growthRate,
          growthRateLate: g ?? prev.growthRateLate,
          discountRate: hasWacc ? suggestedWacc : prev.discountRate,
        }));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "网络错误");
    } finally {
      setLoading(false);
    }
  }, []);

  // 支持 URL ?symbol=XXX 自动分析；?cacheOnly=1 时仅从数据库取数（来自分析历史「查看」）
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const q = params.get("symbol")?.trim().toUpperCase();
    const cacheOnly = params.get("cacheOnly") === "1";
    if (q) fetchTicker(q, cacheOnly);
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
      growthRateLate: params.growthRateLate,
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
          growthRateLate: params.growthRateLate,
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
    growthRateLate: number;
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
      growthRateLate: advice.growthRateLate,
      discountRate: advice.discountRate,
      terminalGrowthRate: advice.terminalGrowthRate,
      projectionYears: advice.projectionYears,
    });
  }, [advice]);

  return (
    <div className="min-h-screen">
      <header className="app-header-bar sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-5">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-xl font-semibold tracking-tight text-white sm:text-2xl">DCF 内在价值</h1>
              <p className="mt-0.5 text-sm text-bloom-muted">现金流折现 · 美股估值</p>
            </div>
            <nav className="flex items-center gap-1 sm:gap-2">
              <Link href="/method" className="nav-link">
                估值方法
              </Link>
              <Link href="/saved" className="nav-link">
                分析历史
              </Link>
            </nav>
          </div>
          <div className="mt-5">
            <TickerSearch onSearch={fetchTicker} loading={loading} />
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        {loading && (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-bloom-muted">
            <Loader2 className="h-9 w-9 animate-spin text-bloom-accent" />
            <span className="text-sm font-medium">正在拉取数据…</span>
          </div>
        )}

        {error && (
          <div className="flex items-start gap-3 rounded-2xl border border-bloom-red/30 bg-bloom-red/10 px-4 py-3.5 text-bloom-red shadow-card">
            <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
            <p className="text-sm leading-relaxed">{error}</p>
          </div>
        )}

        {noFCFWarning && !loading && (
          <div className="flex items-start gap-3 rounded-2xl border border-bloom-amber/25 bg-bloom-amber/10 px-4 py-3.5 text-bloom-amber shadow-card">
            <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
            <p className="text-sm leading-relaxed">该标的暂无或缺少自由现金流数据，无法计算 DCF 估值。</p>
          </div>
        )}

        {data && !loading && (
          <>
            <QuoteCard quote={data.quote} />

            {data.valuationMetrics && data.valuationMetrics.length > 0 && (
              <ValuationChart data={data.valuationMetrics} />
            )}
            {data && (!data.valuationMetrics || data.valuationMetrics.length === 0) && (
              <p className="text-xs text-bloom-muted rounded-2xl border border-white/[0.06] bg-bloom-surface/60 px-4 py-3.5 leading-relaxed">
                暂无估值指标折线图（需使用 Alpha Vantage 抓取）。在「分析历史」中对该股票点击「更新」可重新抓取并显示 P/S、P/E、P/FCF 走势。
              </p>
            )}

            {hasFCF && (
              <>
                <div className="app-card p-6">
                  <h3 className="text-sm font-semibold text-white tracking-wide mb-1 flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-bloom-amber" />
                    DCF 参数专家意见
                  </h3>
                  <p className="text-xs text-bloom-muted mb-4">由 Gemini 大模型根据公司数据给出参数建议，仅供参考。</p>
                  <div className="flex flex-wrap gap-3">
                    <button
                      onClick={fetchAdvice}
                      disabled={adviceLoading}
                      className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium bg-bloom-amber/15 text-bloom-amber ring-1 ring-bloom-amber/20 hover:bg-bloom-amber/25 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {adviceLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                      {adviceLoading ? "获取中…" : "获取专家意见"}
                    </button>
                    {advice && (
                      <button
                        onClick={applyAdvice}
                        className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium bg-bloom-green/15 text-bloom-green ring-1 ring-bloom-green/20 hover:bg-bloom-green/25 transition-colors"
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
                        建议参数：前 5 年增长率 {(advice.growthRate * 100).toFixed(1)}%
                        {advice.projectionYears > 5
                          ? `，第 6 年及以后 ${(advice.growthRateLate * 100).toFixed(1)}%`
                          : ""}
                        ，折现率 {(advice.discountRate * 100).toFixed(1)}%，永续 {(advice.terminalGrowthRate * 100).toFixed(1)}%，预测 {advice.projectionYears} 年
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
                      className="w-full inline-flex items-center justify-center gap-2 rounded-xl py-3.5 px-4 text-sm font-semibold bg-bloom-accent/15 text-bloom-accent ring-1 ring-bloom-accent/25 hover:bg-bloom-accent/25 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
                  <div className="app-card p-6">
                    <h3 className="text-sm font-semibold text-white tracking-wide mb-4">DCF 汇总</h3>
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
          <div className="app-card mx-auto max-w-lg px-8 py-14 text-center">
            <p className="text-sm font-medium text-white">开始分析</p>
            <p className="mt-2 text-sm text-bloom-muted leading-relaxed">
              输入美股代码（如 AAPL、MSFT）查看行情、估值指标与 DCF 内在价值。
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
