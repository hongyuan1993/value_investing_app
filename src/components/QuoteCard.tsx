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
    <div className="app-card overflow-hidden p-6 sm:p-7">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-semibold tracking-tight text-white sm:text-2xl">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-bloom-accent/15 text-bloom-accent ring-1 ring-bloom-accent/20">
              <Building2 className="h-5 w-5" />
            </span>
            {quote.shortName ?? quote.symbol}
          </h2>
          <p className="mt-1 font-mono text-sm text-bloom-muted">{quote.symbol}</p>
        </div>
        <div className="text-left sm:text-right">
          <p className="font-mono text-3xl font-semibold tracking-tight text-white tabular-nums">
            {quote.currency === "USD" ? "$" : ""}
            {formatNum(price)}
          </p>
          <p
            className={`mt-1 flex items-center gap-1 font-mono text-sm tabular-nums sm:justify-end ${isUp ? "text-bloom-green" : "text-bloom-red"}`}
          >
            {isUp ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
            {isUp ? "+" : ""}
            {formatNum(change)} ({isUp ? "+" : ""}
            {formatNum(changePct)}%)
          </p>
        </div>
      </div>
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
        {[
          { icon: DollarSign, label: "市值", value: formatBig(quote.marketCap) },
          { icon: BarChart3, label: "市盈率（TTM）", value: formatNum(quote.trailingPE) === "—" ? "—" : formatNum(quote.trailingPE) },
          { icon: BarChart3, label: "预期市盈率", value: formatNum(quote.forwardPE) },
          {
            icon: Building2,
            label: "流通股数",
            value: quote.sharesOutstanding != null ? formatBig(quote.sharesOutstanding) : "—",
          },
        ].map(({ icon: Icon, label, value }) => (
          <div
            key={label}
            className="rounded-xl border border-white/[0.05] bg-bloom-bg/40 px-3 py-3 sm:px-4"
          >
            <div className="flex items-center gap-2 text-bloom-muted">
              <Icon className="h-3.5 w-3.5 shrink-0 opacity-80" />
              <p className="text-[11px] font-medium uppercase tracking-wide">{label}</p>
            </div>
            <p className="mt-1.5 font-mono text-sm text-white tabular-nums">{value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
