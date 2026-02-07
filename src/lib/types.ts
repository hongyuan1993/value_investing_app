/** API: stock quote + summary for a ticker */
export interface StockQuote {
  symbol: string;
  shortName?: string;
  regularMarketPrice?: number;
  regularMarketChange?: number;
  regularMarketChangePercent?: number;
  marketCap?: number;
  trailingPE?: number;
  forwardPE?: number;
  sharesOutstanding?: number;
  currency?: string;
}

/** API: free cash flow from cashflow statement (annual) */
export interface FCFEntry {
  date: number; // year end timestamp or year
  freeCashflow?: number;
  /** Fallback: operating cash flow - cap ex */
  operatingCashflow?: number;
  capitalExpenditure?: number;
}

/** API: combined response for ticker lookup */
export interface TickerData {
  quote: StockQuote;
  fcfHistory: FCFEntry[];
  /** Analyst "Next 5 Years (per annum)" growth rate (decimal, e.g. 0.12 = 12%), if available */
  analystGrowthRate5y?: number;
  /** 建议 WACC（折现率），基于 Beta 或行业估算，小数 e.g. 0.10 */
  suggestedWacc?: number;
  /** WACC 初值计算过程简述 */
  waccSource?: string;
  rawCashflow?: unknown;
}
