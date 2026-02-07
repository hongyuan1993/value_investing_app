"use client";

export interface DCFParamValues {
  growthRate: number;
  discountRate: number;
  terminalGrowthRate: number;
  projectionYears: number;
}

interface DCFParamsProps {
  values: DCFParamValues;
  onChange: (values: DCFParamValues) => void;
  disabled?: boolean;
  /** FCF 增长率初值计算过程简述，在分析结果中展示 */
  growthRateSource?: string | null;
  /** WACC 初值计算过程简述（基于 Beta/行业） */
  waccSource?: string | null;
}

const toPct = (v: number) => (v * 100).toFixed(1);

export function DCFParams({ values, onChange, disabled, growthRateSource, waccSource }: DCFParamsProps) {
  const update = (key: keyof DCFParamValues, value: number) => {
    onChange({ ...values, [key]: value });
  };

  return (
    <div className="rounded-xl border border-bloom-border bg-bloom-surface p-5 space-y-5">
      <h3 className="text-sm font-semibold text-white uppercase tracking-wider">DCF 参数</h3>
      <p className="text-xs text-bloom-muted">
        常见范围：FCF 增长率 5–15%，WACC 8–12%，永续增长率 2–3%。永续增长率应小于 WACC。
      </p>

      <div>
        <label className="flex justify-between text-sm text-bloom-muted mb-1">
          <span>FCF 增长率（预测期）</span>
          <span className="font-mono text-white">{toPct(values.growthRate)}%</span>
        </label>
        <input
          type="range"
          min={0}
          max={50}
          step={0.5}
          value={values.growthRate * 100}
          onChange={(e) => update("growthRate", parseFloat(e.target.value) / 100)}
          disabled={disabled}
          className="w-full h-2 rounded-full bg-bloom-border appearance-none cursor-pointer accent-bloom-accent disabled:opacity-50"
        />
        <p className="text-xs text-bloom-muted mt-0.5">有历史 FCF 时会自动建议；成熟公司常用 5–10%。</p>
        {growthRateSource && (
          <p className="text-xs text-bloom-accent/90 mt-1">初值：{growthRateSource}</p>
        )}
      </div>

      <div>
        <label className="flex justify-between text-sm text-bloom-muted mb-1">
          <span>折现率（WACC）</span>
          <span className="font-mono text-white">{toPct(values.discountRate)}%</span>
        </label>
        <input
          type="range"
          min={5}
          max={25}
          step={0.25}
          value={values.discountRate * 100}
          onChange={(e) => update("discountRate", parseFloat(e.target.value) / 100)}
          disabled={disabled}
          className="w-full h-2 rounded-full bg-bloom-border appearance-none cursor-pointer accent-bloom-accent disabled:opacity-50"
        />
        <p className="text-xs text-bloom-muted mt-0.5">资本成本；大盘股约 10%，风险越高可设越高。</p>
        {waccSource ? (
          <p className="text-xs text-bloom-accent/90 mt-1">初值：{waccSource}</p>
        ) : (
          <p className="text-xs text-bloom-accent/90 mt-1">初值逻辑：默认 10%，视为大盘股资本成本；实际可依无风险利率、β 与债务成本估算。</p>
        )}
      </div>

      <div>
        <label className="flex justify-between text-sm text-bloom-muted mb-1">
          <span>永续增长率</span>
          <span className="font-mono text-white">{toPct(values.terminalGrowthRate)}%</span>
        </label>
        <input
          type="range"
          min={0}
          max={10}
          step={0.25}
          value={values.terminalGrowthRate * 100}
          onChange={(e) => update("terminalGrowthRate", parseFloat(e.target.value) / 100)}
          disabled={disabled}
          className="w-full h-2 rounded-full bg-bloom-border appearance-none cursor-pointer accent-bloom-accent disabled:opacity-50"
        />
        <p className="text-xs text-bloom-muted mt-0.5">长期永续增长，常用 2–3%（约等于 GDP）。须小于 WACC。</p>
        <p className="text-xs text-bloom-accent/90 mt-1">初值逻辑：默认 2.5%，通常取长期 GDP/通胀水平；须小于 WACC 终值才有效。</p>
      </div>

      <div>
        <label className="flex justify-between text-sm text-bloom-muted mb-1">
          <span>预测年数</span>
          <span className="font-mono text-white">{values.projectionYears}</span>
        </label>
        <input
          type="range"
          min={5}
          max={10}
          step={1}
          value={values.projectionYears}
          onChange={(e) => update("projectionYears", parseInt(e.target.value, 10))}
          disabled={disabled}
          className="w-full h-2 rounded-full bg-bloom-border appearance-none cursor-pointer accent-bloom-accent disabled:opacity-50"
        />
        <p className="text-xs text-bloom-muted mt-0.5">显式预测 5–10 年 FCF，之后按终值计算。</p>
        <p className="text-xs text-bloom-accent/90 mt-1">初值逻辑：默认 5 年，为常用显式预测期；可依行业可见度与现金流可预测性在 5–10 年间调整。</p>
      </div>
    </div>
  );
}
