"use client";

interface ValuationGaugeProps {
  currentPrice: number;
  intrinsicValue: number;
  currency?: string;
}

function formatPrice(n: number, currency?: string): string {
  const prefix = currency === "USD" ? "$" : "";
  return prefix + n.toLocaleString(undefined, { maximumFractionDigits: 2, minimumFractionDigits: 2 });
}

export function ValuationGauge({ currentPrice, intrinsicValue, currency = "USD" }: ValuationGaugeProps) {
  if (!Number.isFinite(currentPrice) || currentPrice <= 0) {
    return (
      <div className="rounded-xl border border-bloom-border bg-bloom-surface p-5 text-center text-bloom-muted">
        暂无价格数据
      </div>
    );
  }

  const ratio = intrinsicValue / currentPrice;
  const pct = (ratio - 1) * 100;
  const isOvervalued = ratio < 1;
  const isUndervalued = ratio > 1;

  // Gauge: 0% = very overvalued, 50% = fair, 100% = very undervalued
  const gaugePct = Math.max(0, Math.min(100, 50 + pct * 5));

  return (
    <div className="rounded-xl border border-bloom-border bg-bloom-surface p-5">
      <h3 className="text-sm font-semibold text-white uppercase tracking-wider mb-4">估值</h3>
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex-1">
          <div className="h-4 rounded-full bg-bloom-border overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{
                width: `${gaugePct}%`,
                backgroundColor: isUndervalued ? "var(--bloom-green)" : isOvervalued ? "var(--bloom-red)" : "var(--bloom-amber)",
              }}
            />
          </div>
          <div className="flex justify-between text-xs text-bloom-muted mt-1">
            <span>高估</span>
            <span>合理</span>
            <span>低估</span>
          </div>
        </div>
        <div className="text-center sm:text-right shrink-0">
          <p className="text-2xl font-mono font-semibold text-white">
            {formatPrice(intrinsicValue, currency)}
          </p>
          <p className="text-sm text-bloom-muted">每股内在价值</p>
          <p className={`mt-1 text-sm font-mono ${isUndervalued ? "text-bloom-green" : isOvervalued ? "text-bloom-red" : "text-bloom-amber"}`}>
            {isUndervalued ? "低估" : isOvervalued ? "高估" : "合理"}
            {" "}({pct >= 0 ? "+" : ""}{pct.toFixed(1)}%)
          </p>
        </div>
      </div>
      <div className="mt-4 pt-4 border-t border-bloom-border flex justify-between text-sm">
        <span className="text-bloom-muted">当前股价</span>
        <span className="font-mono text-white">{formatPrice(currentPrice, currency)}</span>
      </div>
    </div>
  );
}
