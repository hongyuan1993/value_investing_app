"use client";

import { TrendingUp, TrendingDown, Building2, BarChart3, DollarSign } from "lucide-react";
import type { StockQuote } from "@/lib/types";

interface QuoteCardProps {
  quote: StockQuote;
}

function formatNum(n: number | undefined, decimals = 2): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return n.toLocaleString(undefined, { maximumFractionDigits: decimals, minimumFractionDigits: decimals });
}

function formatBig(n: number | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  if (n >= 1e12) return (n / 1e12).toFixed(2) + "T";
  if (n >= 1e9) return (n / 1e9).toFixed(2) + "B";
  if (n >= 1e6) return (n / 1e6).toFixed(2) + "M";
  return n.toLocaleString();
}

export function QuoteCard({ quote }: QuoteCardProps) {
  const price = quote.regularMarketPrice;
  const change = quote.regularMarketChange ?? 0;
  const changePct = quote.regularMarketChangePercent ?? 0;
  const isUp = change >= 0;

  return (
    <div className="rounded-xl border border-bloom-border bg-bloom-surface p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-white flex items-center gap-2">
            <Building2 className="h-5 w-5 text-bloom-accent" />
            {quote.shortName ?? quote.symbol}
          </h2>
          <p className="text-bloom-muted text-sm font-mono mt-0.5">{quote.symbol}</p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-mono font-semibold text-white">
            {quote.currency === "USD" ? "$" : ""}{formatNum(price)}
          </p>
          <p className={`text-sm font-mono flex items-center justify-end gap-1 ${isUp ? "text-bloom-green" : "text-bloom-red"}`}>
            {isUp ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
            {isUp ? "+" : ""}{formatNum(change)} ({isUp ? "+" : ""}{formatNum(changePct)}%)
          </p>
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-5 pt-4 border-t border-bloom-border">
        <div className="flex items-center gap-2">
          <DollarSign className="h-4 w-4 text-bloom-muted" />
          <div>
            <p className="text-xs text-bloom-muted">市值</p>
            <p className="font-mono text-sm text-white">{formatBig(quote.marketCap)}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-bloom-muted" />
          <div>
            <p className="text-xs text-bloom-muted">市盈率（TTM）</p>
            <p className="font-mono text-sm text-white">{formatNum(quote.trailingPE) === "—" ? "—" : formatNum(quote.trailingPE)}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-bloom-muted" />
          <div>
            <p className="text-xs text-bloom-muted">预期市盈率</p>
            <p className="font-mono text-sm text-white">{formatNum(quote.forwardPE)}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Building2 className="h-4 w-4 text-bloom-muted" />
          <div>
            <p className="text-xs text-bloom-muted">流通股数</p>
            <p className="font-mono text-sm text-white">{quote.sharesOutstanding != null ? formatBig(quote.sharesOutstanding) : "—"}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
