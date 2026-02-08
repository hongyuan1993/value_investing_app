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
