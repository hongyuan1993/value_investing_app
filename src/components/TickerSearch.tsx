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
    <form onSubmit={handleSubmit} className="flex gap-2">
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-bloom-muted" />
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="如 AAPL、TSLA、MSFT"
          className="w-full h-11 pl-10 pr-4 rounded-lg bg-bloom-surface border border-bloom-border text-white placeholder:text-bloom-muted focus:outline-none focus:ring-2 focus:ring-bloom-accent focus:border-transparent font-mono uppercase"
          disabled={loading}
        />
      </div>
      <button
        type="submit"
        disabled={loading || !value.trim()}
        className="h-11 px-5 rounded-lg bg-bloom-accent text-bloom-bg font-medium hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
      >
        {loading ? "加载中…" : "分析"}
      </button>
    </form>
  );
}
