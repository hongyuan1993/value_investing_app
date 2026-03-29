"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { ArrowLeft, RefreshCw, Loader2, AlertCircle, History } from "lucide-react";

interface SavedRow {
  symbol: string;
  quote: { shortName?: string; regularMarketPrice?: number; currency?: string };
  fcf_history: unknown[];
  projection_years: number | null;
  intrinsic_value_per_share: number | null;
  updated_at: string;
  created_at: string;
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function formatPrice(n: number | undefined, currency?: string): string {
  if (n == null || !Number.isFinite(n)) return "—";
  const prefix = currency === "USD" ? "$" : "";
  return prefix + n.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

/** 计算高估/低估百分比：(当前价 - 内在价值) / 内在价值 */
function premiumPct(currentPrice: number | undefined, intrinsicValue: number | undefined): number | null {
  if (
    currentPrice == null ||
    !Number.isFinite(currentPrice) ||
    intrinsicValue == null ||
    !Number.isFinite(intrinsicValue) ||
    intrinsicValue <= 0
  )
    return null;
  return (currentPrice - intrinsicValue) / intrinsicValue;
}

export default function SavedPage() {
  const [rows, setRows] = useState<SavedRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updating, setUpdating] = useState<string | null>(null);

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/history");
      const text = await res.text();
      let json: unknown;
      try {
        json = JSON.parse(text);
      } catch {
        setError("服务器返回了无效响应。");
        setRows([]);
        return;
      }
      if (!res.ok) {
        const msg = json && typeof json === "object" && "error" in json ? (json as { error: string }).error : "获取历史失败";
        setError(msg);
        setRows([]);
        return;
      }
      setRows(Array.isArray(json) ? json : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "网络错误");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const handleUpdate = useCallback(
    async (symbol: string) => {
      setUpdating(symbol);
      try {
        const res = await fetch(`/api/ticker/${encodeURIComponent(symbol)}`, { method: "POST" });
        const text = await res.text();
        let json: unknown;
        try {
          json = JSON.parse(text);
        } catch {
          return;
        }
        if (res.ok) {
          await fetchHistory();
        } else {
          const msg = json && typeof json === "object" && "error" in json ? (json as { error: string }).error : "更新失败";
          alert(msg);
        }
      } catch (e) {
        alert(e instanceof Error ? e.message : "更新失败");
      } finally {
        setUpdating(null);
      }
    },
    [fetchHistory]
  );

  return (
    <div className="min-h-screen">
      <header className="app-header-bar sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight text-white sm:text-2xl">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-bloom-accent/15 text-bloom-accent ring-1 ring-bloom-accent/20">
                  <History className="h-5 w-5" />
                </span>
                分析历史
              </h1>
              <p className="mt-0.5 text-sm text-bloom-muted">已保存的 DCF 分析记录</p>
            </div>
            <nav className="flex flex-wrap items-center gap-1">
              <Link href="/method" className="nav-link">
                估值方法
              </Link>
              <Link href="/" className="nav-link inline-flex items-center gap-1.5">
                <ArrowLeft className="h-4 w-4 opacity-70" />
                返回首页
              </Link>
            </nav>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        {loading && (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-bloom-muted">
            <Loader2 className="h-9 w-9 animate-spin text-bloom-accent" />
            <span className="text-sm font-medium">加载中…</span>
          </div>
        )}

        {error && (
          <div className="mb-6 flex items-start gap-3 rounded-2xl border border-bloom-red/30 bg-bloom-red/10 px-4 py-3.5 text-bloom-red shadow-card">
            <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
            <p className="text-sm leading-relaxed">{error}</p>
          </div>
        )}

        {!loading && rows.length === 0 && !error && (
          <div className="app-card mx-auto max-w-md px-8 py-14 text-center">
            <p className="font-medium text-white">暂无记录</p>
            <p className="mt-2 text-sm text-bloom-muted leading-relaxed">
              在首页分析股票后，点击「保存分析」即可保存到此。
            </p>
            <Link
              href="/"
              className="btn-primary mt-6 inline-flex text-sm"
            >
              去分析
            </Link>
          </div>
        )}

        {!loading && rows.length > 0 && (
          <div className="space-y-3">
            <p className="text-sm text-bloom-muted">共 <span className="font-mono text-white">{rows.length}</span> 条分析记录</p>
            <div className="app-card overflow-hidden -mx-1 px-1 sm:mx-0">
              <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-xs sm:text-sm">
                <thead className="border-b border-white/[0.06] bg-bloom-bg/30 text-[10px] font-medium uppercase tracking-wider text-bloom-muted sm:text-xs">
                  <tr>
                    <th className="px-2 py-2 sm:px-4 sm:py-3 font-medium w-0"> </th>
                    <th className="px-2 py-2 sm:px-4 sm:py-3 font-medium">代码</th>
                    <th className="px-2 py-2 sm:px-4 sm:py-3 font-medium">名称</th>
                    <th className="px-2 py-2 sm:px-4 sm:py-3 font-medium">最新价</th>
                    <th className="px-2 py-2 sm:px-4 sm:py-3 font-medium">内在价值</th>
                    <th className="px-2 py-2 sm:px-4 sm:py-3 font-medium">估值</th>
                    <th className="px-2 py-2 sm:px-4 sm:py-3 font-medium">更新时间</th>
                    <th className="px-2 py-2 sm:px-4 sm:py-3 font-medium text-right">操作</th>
                  </tr>
                </thead>
                <tbody className="text-xs sm:text-sm">
                  {rows.map((r) => {
                    const intrinsic = r.intrinsic_value_per_share;
                    const current = r.quote?.regularMarketPrice;
                    const pct = premiumPct(current, intrinsic ?? undefined);
                    const valuationLabel =
                      pct == null
                        ? "—"
                        : pct > 0.1
                          ? "高估"
                          : pct < -0.1
                            ? "低估"
                            : "合理";
                    const valuationClass =
                      pct == null
                        ? "text-bloom-muted"
                        : pct > 0.1
                          ? "text-bloom-red"
                          : pct < -0.1
                            ? "text-bloom-green"
                            : "text-bloom-amber";
                    const isUpdating = updating === r.symbol;
                    return (
                      <tr key={r.symbol} className="border-t border-white/[0.04] transition-colors hover:bg-white/[0.03]">
                        <td className="px-2 py-2 sm:px-4 sm:py-3 align-middle w-0">
                          <Link
                            href={`/?symbol=${encodeURIComponent(r.symbol)}&cacheOnly=1`}
                            className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl bg-bloom-accent px-3 text-sm font-semibold text-bloom-bg shadow-glow transition hover:brightness-110 active:scale-[0.98] sm:min-h-[40px] sm:min-w-[40px]"
                          >
                            查看
                          </Link>
                        </td>
                        <td className="px-2 py-2 sm:px-4 sm:py-3 font-mono font-medium text-white">{r.symbol}</td>
                        <td className="px-2 py-2 sm:px-4 sm:py-3 text-white max-w-[4rem] sm:max-w-none truncate" title={r.quote?.shortName ?? undefined}>{r.quote?.shortName ?? "—"}</td>
                        <td className="px-2 py-2 sm:px-4 sm:py-3 font-mono text-white">
                          {formatPrice(r.quote?.regularMarketPrice, r.quote?.currency)}
                        </td>
                        <td className="px-2 py-2 sm:px-4 sm:py-3 font-mono text-white">
                          {intrinsic != null && Number.isFinite(intrinsic)
                            ? formatPrice(intrinsic, r.quote?.currency)
                            : "—"}
                        </td>
                        <td className={`px-2 py-2 sm:px-4 sm:py-3 font-medium ${valuationClass}`}>
                          {valuationLabel}
                          {pct != null && Number.isFinite(pct) ? ` (${(pct * 100 >= 0 ? "+" : "")}${(pct * 100).toFixed(1)}%)` : ""}
                        </td>
                        <td className="px-2 py-2 sm:px-4 sm:py-3 text-bloom-muted whitespace-nowrap">{formatDate(r.updated_at)}</td>
                        <td className="px-2 py-2 sm:px-4 sm:py-3 text-right align-middle">
                          <button
                            onClick={() => handleUpdate(r.symbol)}
                            disabled={isUpdating}
                            className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center gap-1 rounded-xl border border-bloom-accent/25 bg-bloom-accent/10 px-2 text-xs font-medium text-bloom-accent transition hover:bg-bloom-accent/20 disabled:cursor-not-allowed disabled:opacity-50 sm:min-h-[40px] sm:min-w-[40px] sm:px-3 sm:text-sm"
                          >
                            {isUpdating ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <RefreshCw className="h-3.5 w-3.5" />
                            )}
                            更新
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              </div>
            </div>
            <p className="text-xs text-bloom-muted mt-3 leading-relaxed">
              「更新」会重新抓取行情与财务数据并写库，不会改动你在首页「保存分析」里存下的 DCF 参数与内在价值。表格中的估值需先在首页保存过才会显示。
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
