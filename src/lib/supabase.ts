import { createClient } from "@supabase/supabase-js";
import type { TickerData } from "./types";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export function getSupabase() {
  if (!url || !key) return null;
  return createClient(url, key);
}

export type DbRow = {
  symbol: string;
  quote: unknown;
  fcf_history: unknown;
  analyst_growth_rate_5y: number | null;
  suggested_wacc: number | null;
  wacc_source: string | null;
  growth_rate: number | null;
  discount_rate: number | null;
  terminal_growth_rate: number | null;
  projection_years: number | null;
  intrinsic_value_per_share: number | null;
  created_at: string;
  updated_at: string;
};

export function dbRowToTickerData(row: DbRow): TickerData {
  return {
    quote: row.quote as TickerData["quote"],
    fcfHistory: Array.isArray(row.fcf_history) ? row.fcf_history : [],
    analystGrowthRate5y: row.analyst_growth_rate_5y ?? undefined,
    suggestedWacc: row.suggested_wacc ?? undefined,
    waccSource: row.wacc_source ?? undefined,
  };
}

export async function saveTickerToSupabase(
  symbol: string,
  data: TickerData
): Promise<boolean> {
  const sb = getSupabase();
  if (!sb) return false;

  const payload = {
    symbol: symbol.toUpperCase(),
    quote: data.quote,
    fcf_history: data.fcfHistory,
    analyst_growth_rate_5y: data.analystGrowthRate5y ?? null,
    suggested_wacc: data.suggestedWacc ?? null,
    wacc_source: data.waccSource ?? null,
    updated_at: new Date().toISOString(),
  };

  const { error } = await sb.from("ticker_analyses").upsert(payload, {
    onConflict: "symbol",
  });
  return !error;
}

export interface SaveAnalysisPayload {
  symbol: string;
  quote: TickerData["quote"];
  fcfHistory: TickerData["fcfHistory"];
  analystGrowthRate5y?: number;
  suggestedWacc?: number;
  waccSource?: string;
  growthRate: number;
  discountRate: number;
  terminalGrowthRate: number;
  projectionYears: number;
  intrinsicValuePerShare: number;
  currentPrice: number;
}

export async function saveAnalysisWithParams(
  payload: SaveAnalysisPayload
): Promise<boolean> {
  const sb = getSupabase();
  if (!sb) return false;

  const row = {
    symbol: payload.symbol.toUpperCase(),
    quote: payload.quote,
    fcf_history: payload.fcfHistory,
    analyst_growth_rate_5y: payload.analystGrowthRate5y ?? null,
    suggested_wacc: payload.suggestedWacc ?? null,
    wacc_source: payload.waccSource ?? null,
    growth_rate: payload.growthRate,
    discount_rate: payload.discountRate,
    terminal_growth_rate: payload.terminalGrowthRate,
    projection_years: payload.projectionYears,
    intrinsic_value_per_share: payload.intrinsicValuePerShare,
    updated_at: new Date().toISOString(),
  };

  const { error } = await sb.from("ticker_analyses").upsert(row, {
    onConflict: "symbol",
  });
  return !error;
}
