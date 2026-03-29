"use client";

import { useState } from "react";
import { Search } from "lucide-react";

interface TickerSearchProps {
  onSearch: (symbol: string) => void;
  loading?: boolean;
}

export function TickerSearch({ onSearch, loading }: TickerSearchProps) {
  const [value, setValue] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const s = value.trim().toUpperCase();
    if (s) onSearch(s);
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 sm:flex-row sm:items-stretch sm:gap-3">
      <div className="relative flex-1">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-bloom-muted" />
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="如 AAPL、TSLA、MSFT"
          className="h-12 w-full rounded-2xl border border-white/[0.08] bg-bloom-surface/80 py-3 pl-11 pr-4 font-mono text-sm uppercase text-white shadow-inner transition placeholder:text-bloom-muted/80 focus:border-bloom-accent/40 focus:outline-none focus:ring-2 focus:ring-bloom-accent/25 disabled:opacity-50"
          disabled={loading}
        />
      </div>
      <button
        type="submit"
        disabled={loading || !value.trim()}
        className="btn-primary h-12 shrink-0 px-8 text-sm sm:w-auto"
      >
        {loading ? "加载中…" : "分析"}
      </button>
    </form>
  );
}
