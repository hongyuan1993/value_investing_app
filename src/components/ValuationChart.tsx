"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import type { ValuationMetricEntry } from "@/lib/types";

interface ValuationChartProps {
  data: ValuationMetricEntry[];
}

function formatTooltipValue(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return value >= 100 ? value.toFixed(0) : value.toFixed(2);
}

const MONTH_LABELS = ["1月", "2月", "3月", "4月", "5月", "6月", "7月", "8月", "9月", "10月", "11月", "12月"];

export function ValuationChart({ data }: ValuationChartProps) {
  if (!data?.length) return null;

  const isMonthly = data.some((d) => d.month != null);
  const chartData = data.map((d) => {
    const xLabel = d.month != null ? `${d.year}-${String(d.month).padStart(2, "0")}` : String(d.year);
    return {
      xLabel,
      year: d.year,
      month: d.month,
      "P/S": d.ps,
      "P/E (GAAP)": d.peGaap,
      "P/FCF": d.pfcf,
    };
  });

  const tickFormatter = (xLabel: string) => {
    const [y, m] = xLabel.split("-");
    if (m != null && y != null) {
      const mi = parseInt(m, 10);
      if (Number.isFinite(mi) && mi >= 1 && mi <= 12) return `${y} ${MONTH_LABELS[mi - 1]}`;
    }
    return xLabel;
  };

  return (
    <div className="rounded-xl border border-bloom-border bg-bloom-surface p-4">
      <h3 className="text-sm font-semibold text-white uppercase tracking-wider mb-4">
        {isMonthly ? "估值指标（按月，过去 5 年）" : "估值指标（过去 5 年）"}
      </h3>
      <div className="h-[280px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--bloom-border)" />
            <XAxis
              dataKey="xLabel"
              stroke="var(--bloom-muted)"
              tick={{ fill: "var(--bloom-muted)", fontSize: 11 }}
              tickFormatter={tickFormatter}
              tickLine={{ stroke: "var(--bloom-border)" }}
              interval={isMonthly ? "preserveStartEnd" : 0}
            />
            <YAxis
              stroke="var(--bloom-muted)"
              tick={{ fill: "var(--bloom-muted)", fontSize: 12 }}
              tickLine={{ stroke: "var(--bloom-border)" }}
              tickFormatter={(v) => (v >= 100 ? `${v}` : String(v))}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "var(--bloom-surface)",
                border: "1px solid var(--bloom-border)",
                borderRadius: "8px",
              }}
              labelStyle={{ color: "var(--bloom-muted)" }}
              formatter={(value, name) => [formatTooltipValue(typeof value === "number" ? value : null), name ?? ""]}
              labelFormatter={(label) => (isMonthly ? tickFormatter(label) : `年份 ${label}`)}
            />
            <Legend
              wrapperStyle={{ fontSize: 12 }}
              formatter={(value) => <span className="text-bloom-muted">{value}</span>}
            />
            <Line
              type="monotone"
              dataKey="P/S"
              stroke="var(--bloom-accent)"
              strokeWidth={2}
              dot={{ fill: "var(--bloom-accent)", r: 4 }}
              connectNulls
            />
            <Line
              type="monotone"
              dataKey="P/E (GAAP)"
              stroke="var(--bloom-green)"
              strokeWidth={2}
              dot={{ fill: "var(--bloom-green)", r: 4 }}
              connectNulls
            />
            <Line
              type="monotone"
              dataKey="P/FCF"
              stroke="var(--bloom-amber)"
              strokeWidth={2}
              dot={{ fill: "var(--bloom-amber)", r: 4 }}
              connectNulls
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
