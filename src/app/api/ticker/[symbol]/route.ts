import { NextResponse } from "next/server";
import type { TickerData, FCFEntry, StockQuote, ValuationMetricEntry } from "@/lib/types";
import { getSupabase, dbRowToTickerData, saveTickerToSupabase } from "@/lib/supabase";

const FETCH_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Accept: "application/json",
  "Accept-Language": "en-US,en;q=0.9",
} as const;

const QUOTE_HOSTS = [
  "https://query1.finance.yahoo.com/v7/finance/quote",
  "https://query2.finance.yahoo.com/v7/finance/quote",
];

const ALPHA_BASE = "https://www.alphavantage.co/query";

function parseNum(s: unknown): number | undefined {
  if (s == null) return undefined;
  if (typeof s === "number" && Number.isFinite(s)) return s;
  const n = Number(String(s).replace(/,/g, ""));
  return Number.isFinite(n) ? n : undefined;
}

const RFR = 0.04; // 无风险利率约 4%（10 年期国债）
const ERP = 0.055; // 股权风险溢价约 5.5%
const WACC_MIN = 0.06;
const WACC_MAX = 0.18;

/** 按行业给出的典型 WACC（无 Beta 时使用） */
const SECTOR_WACC: Record<string, number> = {
  Technology: 0.105,
  "Consumer Cyclical": 0.09,
  "Consumer Defensive": 0.07,
  Healthcare: 0.08,
  Utilities: 0.06,
  "Financial Services": 0.09,
  Industrials: 0.08,
  Energy: 0.08,
  "Basic Materials": 0.08,
  "Real Estate": 0.07,
  "Communication Services": 0.08,
};

function suggestWacc(beta: number | undefined, sector: string | undefined): { wacc: number; source: string } | null {
  if (beta != null && Number.isFinite(beta)) {
    const wacc = Math.max(WACC_MIN, Math.min(WACC_MAX, RFR + beta * ERP));
    const pct = (wacc * 100).toFixed(1);
    const betaStr = beta.toFixed(2);
    return { wacc, source: `无风险利率 ${RFR * 100}% + β ${betaStr}×${ERP * 100}% ≈ ${pct}%` };
  }
  if (sector && typeof sector === "string") {
    const key = Object.keys(SECTOR_WACC).find((k) => sector.includes(k) || k.includes(sector));
    const wacc = key ? SECTOR_WACC[key] : 0.10;
    const pct = (wacc * 100).toFixed(1);
    return { wacc, source: `按行业「${sector}」典型 WACC ≈ ${pct}%` };
  }
  return null;
}

type AlphaResult =
  | { ok: true; quote: StockQuote; fcfHistory: FCFEntry[]; suggestedWacc?: number; waccSource?: string; valuationMetrics?: ValuationMetricEntry[] }
  | { ok: false; error: string };

const ALPHA_DELAY_MS = 1300; // Free tier ~1 request/sec; stagger 3 calls to avoid rate limit

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** 从 Alpha Vantage 抓取过去 5 年 P/S、P/E (GAAP)、P/FCF，用于估值指标折线图 */
async function fetchValuationMetricsAlpha(
  symbol: string,
  key: string,
  sharesOutstanding: number,
  cashflowAnnualReports: Record<string, unknown>[]
): Promise<ValuationMetricEntry[]> {
  const enc = encodeURIComponent(symbol);
  const keyEnc = encodeURIComponent(key);
  try {
    const earningsRes = await fetch(
      `${ALPHA_BASE}?function=EARNINGS&symbol=${enc}&apikey=${keyEnc}`,
      { next: { revalidate: 3600 } }
    );
    const earningsText = await earningsRes.text();
    await delay(ALPHA_DELAY_MS);
    const incomeRes = await fetch(
      `${ALPHA_BASE}?function=INCOME_STATEMENT&symbol=${enc}&apikey=${keyEnc}`,
      { next: { revalidate: 3600 } }
    );
    const incomeText = await incomeRes.text();
    await delay(ALPHA_DELAY_MS);
    const tsRes = await fetch(
      `${ALPHA_BASE}?function=TIME_SERIES_MONTHLY_ADJUSTED&symbol=${enc}&apikey=${keyEnc}`,
      { next: { revalidate: 3600 } }
    );
    const tsText = await tsRes.text();

    const earningsJson = earningsText.startsWith("{") ? (JSON.parse(earningsText) as Record<string, unknown>) : {};
    const incomeJson = incomeText.startsWith("{") ? (JSON.parse(incomeText) as Record<string, unknown>) : {};
    const tsJson = tsText.startsWith("{") ? (JSON.parse(tsText) as Record<string, unknown>) : {};

    const earningsErr = earningsJson.Information ?? earningsJson.Note ?? earningsJson["Error Message"];
    const incomeErr = incomeJson.Information ?? incomeJson.Note ?? incomeJson["Error Message"];
    const tsErr = tsJson.Information ?? tsJson.Note ?? tsJson["Error Message"];

    const annualEarnings =
      earningsErr != null ? [] : (earningsJson.annualEarnings as { fiscalDateEnding?: string; reportedEPS?: string; reported_eps?: string }[] | undefined) ?? [];
    const incomeAnnual =
      incomeErr != null ? [] : (incomeJson.annualReports as Record<string, unknown>[] | undefined) ?? [];
    const tsMonthlyRaw = tsErr != null ? {} : (tsJson["Monthly Adjusted Time Series"] ?? tsJson["Monthly adjusted time series"]) as Record<string, Record<string, string>> | undefined;
    const tsMonthly = tsMonthlyRaw ?? {};

    const fcfByYear: Record<number, number> = {};
    for (const r of cashflowAnnualReports) {
      const dateStr = (r.fiscalDateEnding ?? r.fiscal_date_ending) as string | undefined;
      if (typeof dateStr !== "string" || dateStr.length < 4) continue;
      const y = parseInt(dateStr.slice(0, 4), 10);
      const op = parseNum(r.operatingCashflow ?? r.operating_cashflow);
      const capEx = parseNum(r.capitalExpenditures ?? r.capital_expenditures);
      const fcf = op != null && capEx != null ? op - Math.abs(capEx) : op ?? undefined;
      if (fcf != null && Number.isFinite(fcf)) fcfByYear[y] = fcf;
    }

    const revenueByYear: Record<number, number> = {};
    for (const r of incomeAnnual) {
      const dateStr = (r.fiscalDateEnding ?? r.fiscal_date_ending) as string | undefined;
      if (typeof dateStr !== "string" || dateStr.length < 4) continue;
      const y = parseInt(dateStr.slice(0, 4), 10);
      const rev = parseNum(r.totalRevenue ?? r.total_revenue);
      if (rev != null && Number.isFinite(rev)) revenueByYear[y] = rev;
    }

    const epsByYear: Record<number, number> = {};
    for (const e of annualEarnings) {
      const dateStr = e.fiscalDateEnding;
      if (typeof dateStr !== "string" || dateStr.length < 4) continue;
      const y = parseInt(dateStr.slice(0, 4), 10);
      const eps = parseNum(e.reportedEPS ?? (e as { reported_eps?: unknown }).reported_eps);
      if (eps != null && Number.isFinite(eps)) epsByYear[y] = eps;
    }

    const monthlyPrices: { year: number; month: number; date: string; close: number }[] = [];
    for (const [dateStr, o] of Object.entries(tsMonthly)) {
      if (typeof dateStr !== "string" || dateStr.length < 7 || !o || typeof o !== "object") continue;
      const parts = dateStr.split("-");
      const y = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10);
      if (!Number.isFinite(y) || !Number.isFinite(m) || m < 1 || m > 12) continue;
      const close = parseNum(
        o["5. adjusted close"] ?? o["4. close"] ?? (o as Record<string, unknown>)["5. adjusted close"] ?? (o as Record<string, unknown>)["4. close"]
      );
      if (close != null && Number.isFinite(close)) monthlyPrices.push({ year: y, month: m, date: dateStr, close });
    }
    monthlyPrices.sort((a, b) => (a.year !== b.year ? a.year - b.year : a.month - b.month));
    const fiveYearsAgo = new Date().getFullYear() - 5;
    const fromIndex = monthlyPrices.findIndex((p) => p.year >= fiveYearsAgo && (p.year > fiveYearsAgo || p.month >= 1));
    const slice = fromIndex < 0 ? monthlyPrices : monthlyPrices.slice(fromIndex);
    const last60 = slice.slice(-60);

    if (last60.length === 0 || !sharesOutstanding || sharesOutstanding <= 0) return [];

    const entries: ValuationMetricEntry[] = last60.map(({ year, month, close }) => {
      const revenue = revenueByYear[year];
      const eps = epsByYear[year];
      const fcf = fcfByYear[year];
      const marketCap = close * sharesOutstanding;
      const ps = revenue != null && revenue > 0 ? marketCap / revenue : null;
      const peGaap = eps != null && eps > 0 ? close / eps : null;
      const pfcf = fcf != null && fcf > 0 ? marketCap / fcf : null;
      return {
        year,
        month,
        ps: ps != null && Number.isFinite(ps) ? ps : null,
        peGaap: peGaap != null && Number.isFinite(peGaap) ? peGaap : null,
        pfcf: pfcf != null && Number.isFinite(pfcf) ? pfcf : null,
        price: close,
      };
    });

    return entries;
  } catch {
    return [];
  }
}

/** Fetch quote + overview + cash flow from Alpha Vantage. Requests are sequential with delay to respect rate limit. */
async function fetchFromAlphaVantage(symbol: string): Promise<AlphaResult> {
  const key = process.env.ALPHA_VANTAGE_API_KEY?.trim();
  if (!key) {
    return { ok: false, error: "no_key" };
  }

  try {
    const enc = encodeURIComponent(symbol);
    const keyEnc = encodeURIComponent(key);
    const opts = { next: { revalidate: 60 } as const };

    const quoteRes = await fetch(
      `${ALPHA_BASE}?function=GLOBAL_QUOTE&symbol=${enc}&apikey=${keyEnc}`,
      opts
    );
    let quoteText = await quoteRes.text();
    await delay(ALPHA_DELAY_MS);

    const overviewRes = await fetch(
      `${ALPHA_BASE}?function=OVERVIEW&symbol=${enc}&apikey=${keyEnc}`,
      { next: { revalidate: 3600 } }
    );
    const overviewText = await overviewRes.text();
    await delay(ALPHA_DELAY_MS);

    const cashflowRes = await fetch(
      `${ALPHA_BASE}?function=CASH_FLOW&symbol=${enc}&apikey=${keyEnc}`,
      { next: { revalidate: 3600 } }
    );
    const cashflowText = await cashflowRes.text();

    if (!quoteText.startsWith("{")) {
      return { ok: false, error: "Alpha Vantage 返回了无效响应。" };
    }
    const quoteJson = JSON.parse(quoteText) as Record<string, unknown>;
    // Alpha Vantage returns "Information" or "Note" or "Error Message" when key/rate limit/symbol issue
    const info = quoteJson["Information"] ?? quoteJson["Note"] ?? quoteJson["Error Message"];
    if (info != null && typeof info === "string") {
      const isRateLimit = /spreading out|rate limit|requests per/i.test(info);
      const friendly = isRateLimit
        ? "Alpha Vantage 请求过于频繁，请约 1 分钟后再试。"
        : info.length > 120 ? info.slice(0, 120) + "…" : info;
      return { ok: false, error: friendly };
    }

    const gq = quoteJson["Global Quote"] as Record<string, unknown> | undefined;
    if (!gq || typeof gq !== "object") {
      return { ok: false, error: "Alpha Vantage：未找到该代码的行情。" };
    }
    // Alpha Vantage uses keys like "05. price", "09. change", "10. change percent"
    const price = parseNum(gq["05. price"]);
    if (price == null || price <= 0) {
      return { ok: false, error: "Alpha Vantage：该代码无有效价格。" };
    }

    const overview = overviewText.startsWith("{") ? (JSON.parse(overviewText) as Record<string, unknown>) : {};
    const cashflow = cashflowText.startsWith("{") ? (JSON.parse(cashflowText) as Record<string, unknown>) : {};

    const marketCap = parseNum(overview.MarketCapitalization);
    const sharesStr = overview.SharesOutstanding;
    const sharesOutstanding = parseNum(sharesStr);
    const pe = parseNum(overview.PERatio);
    const change = parseNum(gq["09. change"]);
    const changePercentStr = String(gq["10. change percent"] ?? "").replace("%", "");
    const changePercent = parseNum(changePercentStr);

    const quote: StockQuote = {
      symbol: (gq["01. symbol"] as string) ?? symbol,
      shortName: (overview.Name as string) ?? symbol,
      regularMarketPrice: price,
      regularMarketChange: change,
      regularMarketChangePercent: changePercent,
      marketCap: marketCap ?? (sharesOutstanding != null && price ? sharesOutstanding * price : undefined),
      trailingPE: pe,
      forwardPE: parseNum(overview.ForwardPE),
      sharesOutstanding,
      currency: "USD",
    };

    const annualReports = (cashflow.annualReports as Record<string, unknown>[] | undefined) ?? [];
    const fcfHistory: FCFEntry[] = annualReports
      .map((r) => {
        const op = parseNum(r.operatingCashflow ?? r.operating_cashflow);
        const capEx = parseNum(r.capitalExpenditures ?? r.capital_expenditures);
        const fcf = op != null && capEx != null ? op - Math.abs(capEx) : op ?? undefined;
        const dateStr = (r.fiscalDateEnding ?? r.fiscal_date_ending) as string | undefined;
        const date = dateStr ? new Date(dateStr).getTime() : 0;
        return { date, freeCashflow: fcf, operatingCashflow: op, capitalExpenditure: capEx };
      })
      .filter((e) => e.freeCashflow != null && Number.isFinite(e.freeCashflow))
      .sort((a, b) => b.date - a.date)
      .slice(0, 10);

    const beta = parseNum(overview.Beta);
    const sector = (overview.Sector as string) ?? undefined;
    const waccResult = suggestWacc(beta, sector);
    const valuationMetrics = await fetchValuationMetricsAlpha(
      symbol,
      key,
      sharesOutstanding ?? 0,
      annualReports
    );
    const result: AlphaResult = {
      ok: true,
      quote,
      fcfHistory,
      ...(waccResult && { suggestedWacc: waccResult.wacc, waccSource: waccResult.source }),
      ...(valuationMetrics.length > 0 && { valuationMetrics }),
    };
    return result;
  } catch (e) {
    const msg = e instanceof Error ? e.message : "未知错误";
    return { ok: false, error: "Alpha Vantage 请求失败：" + msg };
  }
}

/** Fetch quote via Yahoo v7 API (no external package). */
async function fetchQuote(symbol: string): Promise<Record<string, unknown> | null> {
  for (const baseUrl of QUOTE_HOSTS) {
    try {
      const url = new URL(baseUrl);
      url.searchParams.set("symbols", symbol);
      const res = await fetch(url.toString(), {
        headers: FETCH_HEADERS,
        next: { revalidate: 60 },
      });
      if (!res.ok) continue;
      const contentType = res.headers.get("content-type") ?? "";
      if (!contentType.includes("application/json")) continue;
      const text = await res.text();
      if (!text.trimStart().startsWith("{")) continue;
      const data = JSON.parse(text) as { quoteResponse?: { result?: unknown[] } };
      const list = data?.quoteResponse?.result;
      if (!Array.isArray(list) || list.length === 0) continue;
      const q = list[0] as Record<string, unknown>;
      if (q?.quoteType === "NONE") continue;
      return q;
    } catch {
      continue;
    }
  }
  return null;
}

/** Fetch Yahoo "Next 5 Years (per annum)" growth from Analysis (earningsTrend / growthEstimate). Returns decimal e.g. 0.12 for 12%. */
async function fetchYahooAnalystGrowth5y(symbol: string): Promise<number | null> {
  const hosts = ["https://query1.finance.yahoo.com", "https://query2.finance.yahoo.com"];
  for (const host of hosts) {
    try {
      const url = new URL(`${host}/v10/finance/quoteSummary/${encodeURIComponent(symbol)}`);
      url.searchParams.set("modules", "earningsTrend,growthEstimate");
      const res = await fetch(url.toString(), {
        headers: FETCH_HEADERS,
        next: { revalidate: 3600 },
      });
      if (!res.ok || !res.headers.get("content-type")?.includes("application/json")) continue;
      const text = await res.text();
      if (!text.trimStart().startsWith("{")) continue;
      const data = JSON.parse(text) as Record<string, unknown>;
      const result = (data?.quoteSummary as { result?: unknown[] } | undefined)?.result?.[0] as Record<string, unknown> | undefined;
      if (!result || typeof result !== "object") continue;
      // growthEstimate.growth = percentage (e.g. 12.5 for 12.5%)
      const growthEstimate = result.growthEstimate as Record<string, unknown> | undefined;
      if (growthEstimate?.growth != null) {
        const g = Number(growthEstimate.growth);
        if (Number.isFinite(g)) return g > 1 ? g / 100 : g;
      }
      // earningsTrend.trend[] with period "+5y" or "5y", growthRate.raw
      const earningsTrend = result.earningsTrend as { trend?: { period?: string; growthRate?: { raw?: number } }[] } | undefined;
      const trend = earningsTrend?.trend;
      if (Array.isArray(trend)) {
        const fiveY = trend.find((t) => /5y|\+5y|5\s*year/i.test(String(t?.period ?? "")));
        const raw = fiveY?.growthRate?.raw;
        if (raw != null && Number.isFinite(raw)) return raw > 1 ? raw / 100 : raw;
      }
    } catch {
      continue;
    }
  }
  return null;
}

async function fetchQuoteSummary(symbol: string): Promise<{
  cashflowStatementHistory?: { cashflowStatements?: Record<string, unknown>[] };
  defaultKeyStatistics?: { sharesOutstanding?: number; beta?: number };
} | null> {
  const hosts = [
    "https://query1.finance.yahoo.com",
    "https://query2.finance.yahoo.com",
  ];
  for (const host of hosts) {
    try {
      const url = new URL(
        `${host}/v10/finance/quoteSummary/${encodeURIComponent(symbol)}`
      );
      url.searchParams.set("modules", "cashflowStatementHistory,defaultKeyStatistics");
      const res = await fetch(url.toString(), {
        headers: FETCH_HEADERS,
        next: { revalidate: 3600 },
      });
      if (!res.ok) continue;
      const contentType = res.headers.get("content-type") ?? "";
      if (!contentType.includes("application/json")) continue;
      const text = await res.text();
      if (!text.trimStart().startsWith("{")) continue;
      const data = JSON.parse(text) as { quoteSummary?: { result?: unknown[] } };
      const body = data?.quoteSummary?.result?.[0];
      if (body && typeof body === "object") return body as {
        cashflowStatementHistory?: { cashflowStatements?: Record<string, unknown>[] };
        defaultKeyStatistics?: { sharesOutstanding?: number; beta?: number };
      };
    } catch {
      continue;
    }
  }
  return null;
}

function toStockQuote(raw: Record<string, unknown>, ticker: string): StockQuote {
  const n = (key: string) => raw[key] as number | undefined;
  const s = (key: string) => raw[key] as string | undefined;
  return {
    symbol: s("symbol") ?? ticker,
    shortName: s("shortName") ?? s("longName"),
    regularMarketPrice: n("regularMarketPrice"),
    regularMarketChange: n("regularMarketChange"),
    regularMarketChangePercent: n("regularMarketChangePercent"),
    marketCap: n("marketCap"),
    trailingPE: n("trailingPE"),
    forwardPE: n("forwardPE"),
    sharesOutstanding: n("sharesOutstanding"),
    currency: s("currency"),
  };
}

function toFCFEntry(item: Record<string, unknown>): FCFEntry {
  const endDate = item.endDate as number | undefined;
  const date = endDate ?? (item.date as number) ?? 0;
  let freeCashflow = item.freeCashflow as number | undefined;
  if (freeCashflow == null) {
    const operating = item.totalCashFromOperatingActivities as number | undefined;
    const capEx = (item.capitalExpenditures as number | undefined) ?? 0;
    if (operating != null && Number.isFinite(operating))
      freeCashflow = operating - Math.abs(capEx);
  }
  return {
    date: typeof date === "number" ? date : Date.parse(String(date)) || 0,
    freeCashflow,
    operatingCashflow: item.totalCashFromOperatingActivities as number | undefined,
    capitalExpenditure: item.capitalExpenditures as number | undefined,
  };
}

function jsonResponse(body: { error?: string } | TickerData, status: number) {
  return NextResponse.json(body, {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/** 从网上抓取股票数据（Alpha Vantage / Yahoo） */
async function fetchTickerDataFromWeb(
  ticker: string
): Promise<TickerData | { error: string }> {
  const alpha = await fetchFromAlphaVantage(ticker);
  if (alpha.ok) {
    const analyst5y = await fetchYahooAnalystGrowth5y(ticker);
    const payload: TickerData = { quote: alpha.quote, fcfHistory: alpha.fcfHistory };
    if (analyst5y != null) payload.analystGrowthRate5y = analyst5y;
    if (alpha.suggestedWacc != null) payload.suggestedWacc = alpha.suggestedWacc;
    if (alpha.waccSource) payload.waccSource = alpha.waccSource;
    if (alpha.valuationMetrics?.length) payload.valuationMetrics = alpha.valuationMetrics;
    return payload;
  }
  if (alpha.error !== "no_key") {
    return { error: alpha.error };
  }

  const [quoteRaw, summaryResult] = await Promise.all([
    fetchQuote(ticker),
    fetchQuoteSummary(ticker),
  ]);

  if (!quoteRaw) {
    const hint =
      " 请在 .env.local 中配置 ALPHA_VANTAGE_API_KEY（免费申请：https://www.alphavantage.co/support/#api-key），修改后需重启开发服务器。";
    return { error: "未找到行情。" + hint };
  }

  const quote: StockQuote = toStockQuote(quoteRaw, ticker);
  const sharesFromSummary = summaryResult?.defaultKeyStatistics?.sharesOutstanding;
  if (sharesFromSummary != null && Number.isFinite(sharesFromSummary))
    quote.sharesOutstanding = sharesFromSummary;

  const cashflowStatements =
    (summaryResult?.cashflowStatementHistory as { cashflowStatements?: Record<string, unknown>[] } | undefined)
      ?.cashflowStatements ?? [];
  const fcfHistory: FCFEntry[] = cashflowStatements
    .map(toFCFEntry)
    .filter((e) => e.freeCashflow != null && Number.isFinite(e.freeCashflow))
    .sort((a, b) => b.date - a.date)
    .slice(0, 10);

  const analyst5y = await fetchYahooAnalystGrowth5y(ticker);
  const beta = parseNum((summaryResult?.defaultKeyStatistics as { beta?: number } | undefined)?.beta);
  const waccResult = suggestWacc(beta, undefined);
  const payload: TickerData = { quote, fcfHistory };
  if (analyst5y != null) payload.analystGrowthRate5y = analyst5y;
  if (waccResult) {
    payload.suggestedWacc = waccResult.wacc;
    payload.waccSource = waccResult.source;
  }
  return payload;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ symbol: string }> }
) {
  try {
    const { symbol } = await params;
    const ticker = (symbol ?? "").trim().toUpperCase();
    if (!ticker) {
      return jsonResponse({ error: "缺少或无效的股票代码" }, 400);
    }

    const url = new URL(request.url);
    const cacheOnly = url.searchParams.get("cacheOnly") === "1";

    const sb = getSupabase();
    if (sb) {
      const { data: row, error } = await sb
        .from("ticker_analyses")
        .select("*")
        .eq("symbol", ticker)
        .single();

      if (!error && row) {
        if (cacheOnly) {
          const cached = dbRowToTickerData(row);
          return jsonResponse(cached, 200);
        }
        const rawMetrics = row?.valuation_metrics;
        const hasValuationMetrics = rawMetrics != null && Array.isArray(rawMetrics) && rawMetrics.length > 0;
        const hasAnyPrice = hasValuationMetrics && (rawMetrics as { price?: number }[]).some((e) => e?.price != null && Number.isFinite(e.price));
        const useCache = !hasValuationMetrics || hasAnyPrice;
        if (useCache) {
          const cached = dbRowToTickerData(row);
          return jsonResponse(cached, 200);
        }
      }

      if (cacheOnly) {
        return jsonResponse({ error: "无该股票的缓存数据，请先在首页分析该股票或在分析历史中点击「更新」。" }, 404);
      }
    }

    const result = await fetchTickerDataFromWeb(ticker);
    if ("error" in result) {
      return jsonResponse(result, result.error.includes("未找到") ? 404 : 502);
    }

    saveTickerToSupabase(ticker, result);
    return jsonResponse(result, 200);
  } catch (err) {
    const message = err instanceof Error ? err.message : "未知错误";
    return jsonResponse({ error: "获取数据失败：" + message }, 502);
  }
}

/** 刷新单只股票：重新从网上抓取并更新 Supabase */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ symbol: string }> }
) {
  try {
    const { symbol } = await params;
    const ticker = (symbol ?? "").trim().toUpperCase();
    if (!ticker) {
      return jsonResponse({ error: "缺少或无效的股票代码" }, 400);
    }

    const result = await fetchTickerDataFromWeb(ticker);
    if ("error" in result) {
      return jsonResponse(result, result.error.includes("未找到") ? 404 : 502);
    }

    const ok = saveTickerToSupabase(ticker, result);
    if (!ok) {
      return jsonResponse({ error: "保存到数据库失败，请检查 Supabase 配置。" }, 502);
    }

    return jsonResponse(result, 200);
  } catch (err) {
    const message = err instanceof Error ? err.message : "未知错误";
    return jsonResponse({ error: "更新数据失败：" + message }, 502);
  }
}
