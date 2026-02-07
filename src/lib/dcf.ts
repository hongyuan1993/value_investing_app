/**
 * DCF (Discounted Cash Flow) valuation logic.
 * - Project FCF for N years with growth rate.
 * - Terminal value with perpetual growth (Gordon model: TV = FCF_{n+1} / (r - g)).
 * - Discount all to present value; divide by shares for intrinsic value per share.
 * - All monetary inputs (baseFcf) and outputs (enterpriseValue, intrinsicValuePerShare) are in full dollars.
 */

export interface DCFParams {
  /** Latest free cash flow (base year), in dollars */
  baseFcf: number;
  /** Number of years to project explicitly */
  projectionYears: number;
  /** Annual FCF growth rate (e.g. 0.10 = 10%) */
  growthRate: number;
  /** Discount rate / WACC (e.g. 0.10 = 10%) */
  discountRate: number;
  /** Terminal perpetual growth rate (e.g. 0.025 = 2.5%) */
  terminalGrowthRate: number;
  /** Number of shares outstanding */
  sharesOutstanding: number;
}

export interface DCFResult {
  /** Present value of projected cash flows */
  pvProjectedFcf: number;
  /** Present value of terminal value */
  pvTerminalValue: number;
  /** Enterprise value (sum of above) */
  enterpriseValue: number;
  /** Intrinsic value per share */
  intrinsicValuePerShare: number;
  /** Projected FCF by year (for display) */
  projectedFcfByYear: { year: number; fcf: number; pv: number }[];
  /** Terminal value (before discounting) */
  terminalValue: number;
}

export function computeDCF(params: DCFParams): DCFResult {
  const {
    baseFcf,
    projectionYears,
    growthRate,
    discountRate,
    terminalGrowthRate,
    sharesOutstanding,
  } = params;

  const projectedFcfByYear: { year: number; fcf: number; pv: number }[] = [];
  let pvProjectedFcf = 0;
  let fcfPrev = baseFcf;

  for (let y = 1; y <= projectionYears; y++) {
    const fcf = fcfPrev * (1 + growthRate);
    fcfPrev = fcf;
    const pv = fcf / Math.pow(1 + discountRate, y);
    pvProjectedFcf += pv;
    projectedFcfByYear.push({ year: y, fcf, pv });
  }

  // Terminal value at end of projection period: FCF_{n+1} / (r - g)
  const fcfTerminal = fcfPrev * (1 + terminalGrowthRate);
  const terminalValue =
    discountRate > terminalGrowthRate
      ? fcfTerminal / (discountRate - terminalGrowthRate)
      : 0;
  const pvTerminalValue = terminalValue / Math.pow(1 + discountRate, projectionYears);

  const enterpriseValue = pvProjectedFcf + pvTerminalValue;
  const intrinsicValuePerShare =
    sharesOutstanding > 0 ? enterpriseValue / sharesOutstanding : 0;

  return {
    pvProjectedFcf,
    pvTerminalValue,
    enterpriseValue,
    intrinsicValuePerShare,
    projectedFcfByYear,
    terminalValue,
  };
}

/** Suggest a growth rate from historical FCF (e.g. 5-year CAGR). Capped for reasonable DCF inputs. */
export function suggestGrowthRateFromHistory(fcfHistory: number[]): number {
  if (fcfHistory.length < 2) return 0.08;
  const first = fcfHistory[fcfHistory.length - 1];
  const last = fcfHistory[0];
  if (first <= 0) return 0.08;
  const years = fcfHistory.length - 1;
  const cagr = Math.pow(last / first, 1 / years) - 1;
  return Math.max(-0.1, Math.min(0.25, cagr));
}

/**
 * 过去 N 年的平均 FCF 增长率（CAGR），再乘以权重（保守处理）。
 * 用于无法获取分析师 5 年增长率时的初值。
 */
export function conservativeGrowthFromHistory(
  fcfHistory: number[],
  years: number = 3,
  weight: number = 0.8
): number | null {
  if (fcfHistory.length < 2) return null;
  const useYears = Math.min(years, fcfHistory.length - 1);
  if (useYears < 1) return null;
  const last = fcfHistory[0];
  const first = fcfHistory[useYears];
  if (first <= 0 || last <= 0) return null;
  const cagr = Math.pow(last / first, 1 / useYears) - 1;
  const conservative = cagr * weight;
  return Math.max(-0.1, Math.min(0.5, conservative));
}
