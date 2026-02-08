import { NextResponse } from "next/server";
import { saveAnalysisWithParams } from "@/lib/supabase";

/** 保存分析结果（含 DCF 参数与估值） */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const symbol = String(body.symbol ?? "").trim().toUpperCase();
    if (!symbol) {
      return NextResponse.json({ error: "缺少股票代码" }, { status: 400 });
    }

    const quote = body.quote;
    const fcfHistory = Array.isArray(body.fcfHistory) ? body.fcfHistory : [];
    const growthRate = Number(body.growthRate);
    const discountRate = Number(body.discountRate);
    const terminalGrowthRate = Number(body.terminalGrowthRate);
    const projectionYears = Math.round(Number(body.projectionYears) || 5);
    const intrinsicValuePerShare = Number(body.intrinsicValuePerShare);
    const currentPrice = Number(body.currentPrice);

    if (!quote || typeof quote !== "object") {
      return NextResponse.json({ error: "缺少行情数据" }, { status: 400 });
    }
    if (
      !Number.isFinite(growthRate) ||
      !Number.isFinite(discountRate) ||
      !Number.isFinite(terminalGrowthRate) ||
      !Number.isFinite(intrinsicValuePerShare) ||
      !Number.isFinite(currentPrice)
    ) {
      return NextResponse.json({ error: "DCF 参数或估值数据无效" }, { status: 400 });
    }

    const ok = await saveAnalysisWithParams({
      symbol,
      quote,
      fcfHistory,
      analystGrowthRate5y: body.analystGrowthRate5y,
      suggestedWacc: body.suggestedWacc,
      waccSource: body.waccSource,
      growthRate,
      discountRate,
      terminalGrowthRate,
      projectionYears,
      intrinsicValuePerShare,
      currentPrice,
    });

    if (!ok) {
      return NextResponse.json({ error: "保存失败，请检查 Supabase 配置。" }, { status: 502 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "未知错误";
    return NextResponse.json({ error: "保存失败：" + message }, { status: 502 });
  }
}
