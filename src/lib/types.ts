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

/** 单年或单月估值指标：P/S、P/E (GAAP)、P/FCF */
export interface ValuationMetricEntry {
  year: number;
  /** 月份 1–12，无则表示整年一点（兼容旧数据） */
  month?: number;
  /** 市销率 Price to Sales */
  ps: number | null;
  /** 市盈率 P/E (GAAP) */
  peGaap: number | null;
  /** 市现率 Price to FCF */
  pfcf: number | null;
}

/** 保存分析时写入的 DCF 参数（用于回显与对比） */
export interface SavedDcfParams {
  growthRate: number;
  discountRate: number;
  terminalGrowthRate: number;
  projectionYears: number;
  intrinsicValuePerShare: number;
  /** 保存时的股价 */
  currentPrice?: number;
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
  /** 过去 5 年估值指标 P/S、P/E (GAAP)、P/FCF，用于折线图 */
  valuationMetrics?: ValuationMetricEntry[];
  /** 上次「保存分析」时设定的 DCF 参数与估值（从缓存加载时回填表单） */
  savedDcfParams?: SavedDcfParams;
  rawCashflow?: unknown;
}
