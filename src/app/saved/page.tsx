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
    <div className="min-h-screen bg-bloom-bg">
      <header className="border-b border-bloom-border bg-bloom-surface/80 backdrop-blur">
        <div className="max-w-5xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-lg font-semibold text-white flex items-center gap-2">
              <History className="h-5 w-5 text-bloom-accent" />
              分析历史
            </h1>
            <div className="flex items-center gap-4">
              <Link href="/method" className="text-sm text-bloom-muted hover:text-white transition-colors">
                估值方法
              </Link>
              <Link
                href="/"
                className="flex items-center gap-2 text-bloom-muted hover:text-white transition-colors text-sm"
              >
                <ArrowLeft className="h-4 w-4" />
                返回首页
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6">
        {loading && (
          <div className="flex items-center justify-center py-12 text-bloom-muted">
            <Loader2 className="h-8 w-8 animate-spin mr-2" />
            加载中…
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 rounded-lg border border-bloom-red/50 bg-bloom-red/10 text-bloom-red px-4 py-3 mb-6">
            <AlertCircle className="h-5 w-5 shrink-0" />
            <p>{error}</p>
          </div>
        )}

        {!loading && rows.length === 0 && !error && (
          <div className="text-center py-16 text-bloom-muted">
            <p>暂无已保存的分析结果。</p>
            <p className="text-sm mt-2">在首页对股票执行「分析」后，点击「保存分析」即可保存到此。</p>
            <Link href="/" className="inline-block mt-4 text-bloom-accent hover:underline">
              去分析 →
            </Link>
          </div>
        )}

        {!loading && rows.length > 0 && (
          <div className="space-y-3">
            <p className="text-bloom-muted text-sm">共 {rows.length} 只股票的分析记录</p>
            <div className="rounded-xl border border-bloom-border overflow-x-auto -mx-1 px-1">
              <table className="w-full text-left min-w-[640px] text-xs sm:text-sm">
                <thead className="bg-bloom-surface text-bloom-muted text-[10px] sm:text-xs uppercase tracking-wider">
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
                      <tr key={r.symbol} className="border-t border-bloom-border hover:bg-bloom-surface/50">
                        <td className="px-2 py-2 sm:px-4 sm:py-3 align-middle w-0">
                          <Link
                            href={`/?symbol=${encodeURIComponent(r.symbol)}&cacheOnly=1`}
                            className="inline-flex items-center justify-center min-h-[44px] min-w-[44px] sm:min-h-[40px] sm:min-w-[40px] rounded-lg bg-bloom-accent text-bloom-bg font-medium text-sm hover:opacity-90 active:opacity-80"
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
                            className="inline-flex items-center justify-center gap-1 min-h-[44px] min-w-[44px] sm:min-h-[40px] sm:min-w-[40px] rounded-lg px-2 sm:px-3 text-xs sm:text-sm font-medium bg-bloom-accent/20 text-bloom-accent hover:bg-bloom-accent/30 disabled:opacity-50 disabled:cursor-not-allowed active:opacity-80"
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
            <p className="text-bloom-muted text-xs mt-2">
              「更新」会重新从网上抓取该股票最新数据并覆盖数据库中的记录。估值需点击「保存分析」后才会显示。
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
