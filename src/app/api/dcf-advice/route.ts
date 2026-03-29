import { NextResponse } from "next/server";
import { GoogleGenerativeAI, GoogleGenerativeAIFetchError } from "@google/generative-ai";

/** 将 SDK / 网络错误转为用户可读文案与合适 HTTP 状态 */
function mapAdviceError(err: unknown): { message: string; status: number } {
  const raw = err instanceof Error ? err.message : String(err);
  const lower = raw.toLowerCase();

  if (err instanceof GoogleGenerativeAIFetchError && err.status === 429) {
    if (lower.includes("spending cap") || lower.includes("exceeded its spending")) {
      return {
        message:
          "Google AI 项目已达到支出上限。请在 Google Cloud 控制台「结算 → 预算」提高支出上限，或为本项目关联有效结算账号后再试。",
        status: 429,
      };
    }
    return {
      message: "Gemini API 请求过于频繁或配额已用尽，请稍后再试。",
      status: 429,
    };
  }

  if (/429|too many requests/i.test(raw) && /spending cap|exceeded its spending/i.test(raw)) {
    return {
      message:
        "Google AI 项目已达到支出上限。请在 Google Cloud 控制台提高预算/支出上限后重试。",
      status: 429,
    };
  }

  if (err instanceof GoogleGenerativeAIFetchError && (err.status === 403 || err.status === 400)) {
    return {
      message: "API 密钥无效或无权访问该模型，请检查 GEMINI_API_KEY 与 GEMINI_MODEL。",
      status: 502,
    };
  }

  if (err instanceof SyntaxError || /unexpected token|json parse/i.test(raw)) {
    return { message: "模型返回格式异常，请重试。", status: 502 };
  }

  const short =
    raw.length > 400
      ? raw.slice(0, 400).replace(/\s+/g, " ").trim() + "…"
      : raw;
  return { message: short, status: 502 };
}

const SYSTEM_PROMPT = `你是一位专业的股票估值分析师，擅长 DCF（现金流折现法）估值。请根据以下公司财务数据，给出 DCF 参数的设定建议。

本应用支持两阶段预测：前 5 个预测年度使用 growthRate；第 6 年及以后使用 growthRateLate（通常不高于前段，反映增速放缓）。若 projectionYears 为 5，则 growthRateLate 可与 growthRate 相同（后段不参与计算）。

请以 JSON 格式回复，且仅回复 JSON，不要其他文字。格式如下：
{
  "growthRate": 0.12,
  "growthRateLate": 0.08,
  "discountRate": 0.10,
  "terminalGrowthRate": 0.025,
  "projectionYears": 10,
  "reasoning": "根据分析师预期、行业特点、宏观经济等因素的简要分析说明（中文）"
}

参数说明（均为小数）：
- growthRate: 前 5 年 FCF 年增长率
- growthRateLate: 第 6 年及以后 FCF 年增长率（可低于 growthRate）
- discountRate: 折现率（WACC），通常 0.06–0.15
- terminalGrowthRate: 永续增长率，通常 0.01–0.03，不应高于长期 GDP 增速
- projectionYears: 预测年数，通常 5–10 年；若用两阶段增长建议 8–10 年`;

function buildContext(data: {
  symbol: string;
  shortName?: string;
  regularMarketPrice?: number;
  marketCap?: number;
  fcfHistory: { date?: number; freeCashflow?: number }[];
  analystGrowthRate5y?: number;
  suggestedWacc?: number;
  waccSource?: string;
  currentParams?: {
    growthRate: number;
    growthRateLate?: number;
    discountRate: number;
    terminalGrowthRate: number;
    projectionYears: number;
  };
}): string {
  const fcfYears = data.fcfHistory
    .filter((e) => e.freeCashflow != null)
    .map((e) => ({
      year: e.date ? new Date(e.date).getFullYear() : "—",
      fcf: e.freeCashflow != null ? `${(e.freeCashflow / 1e9).toFixed(2)}B USD` : "—",
    }));

  let text = `
公司代码：${data.symbol}
公司名称：${data.shortName ?? "—"}
当前股价：${data.regularMarketPrice != null ? "$" + data.regularMarketPrice.toFixed(2) : "—"}
市值：${data.marketCap != null ? "$" + (data.marketCap / 1e9).toFixed(2) + "B" : "—"}

历史 FCF（年度）：
${JSON.stringify(fcfYears, null, 2)}
`;

  if (data.analystGrowthRate5y != null) {
    text += `\n分析师预期 5 年增长率：${(data.analystGrowthRate5y * 100).toFixed(1)}%\n`;
  }
  if (data.suggestedWacc != null) {
    text += `建议 WACC（折现率）：${(data.suggestedWacc * 100).toFixed(1)}%\n`;
  }
  if (data.waccSource) {
    text += `WACC 来源：${data.waccSource}\n`;
  }
  if (data.currentParams) {
    const late = data.currentParams.growthRateLate ?? data.currentParams.growthRate;
    text += `\n用户当前参数：前 5 年增长率 ${(data.currentParams.growthRate * 100).toFixed(1)}%，第 6 年及以后 ${(late * 100).toFixed(1)}%，折现率 ${(data.currentParams.discountRate * 100).toFixed(1)}%，永续增长率 ${(data.currentParams.terminalGrowthRate * 100).toFixed(1)}%，预测 ${data.currentParams.projectionYears} 年\n`;
  }

  return text;
}

export async function POST(request: Request) {
  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key) {
    return NextResponse.json(
      { error: "请在 .env.local 中配置 GEMINI_API_KEY（可从 https://aistudio.google.com/app/apikey 获取）" },
      { status: 503 }
    );
  }

  try {
    const body = await request.json();
    const symbol = String(body.symbol ?? "").trim();
    const quote = body.quote;
    const fcfHistory = Array.isArray(body.fcfHistory) ? body.fcfHistory : [];

    if (!symbol || !quote || typeof quote !== "object") {
      return NextResponse.json({ error: "缺少股票数据" }, { status: 400 });
    }

    const context = buildContext({
      symbol,
      shortName: quote.shortName,
      regularMarketPrice: quote.regularMarketPrice,
      marketCap: quote.marketCap,
      fcfHistory,
      analystGrowthRate5y: body.analystGrowthRate5y,
      suggestedWacc: body.suggestedWacc,
      waccSource: body.waccSource,
      currentParams: body.currentParams,
    });

    const genAI = new GoogleGenerativeAI(key);
    const modelId = process.env.GEMINI_MODEL ?? "gemini-3-flash-preview";
    const model = genAI.getGenerativeModel({ model: modelId });

    const result = await model.generateContent(SYSTEM_PROMPT + "\n\n" + context);
    const response = result.response;
    const raw = response.text()?.trim() ?? "";

    // 尝试提取 JSON（可能被 markdown 包裹）
    let jsonStr = raw;
    const codeBlock = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (codeBlock) jsonStr = codeBlock[1].trim();

    const parsed = JSON.parse(jsonStr) as {
      growthRate?: number;
      growthRateLate?: number;
      discountRate?: number;
      terminalGrowthRate?: number;
      projectionYears?: number;
      reasoning?: string;
    };

    const g0 = clamp(parsed.growthRate ?? 0.1, 0.01, 0.5);
    const g1 = clamp(parsed.growthRateLate ?? g0, 0.01, 0.5);
    const advice = {
      growthRate: g0,
      growthRateLate: g1,
      discountRate: clamp(parsed.discountRate ?? 0.1, 0.05, 0.25),
      terminalGrowthRate: clamp(parsed.terminalGrowthRate ?? 0.025, 0.005, 0.05),
      projectionYears: Math.round(clamp(parsed.projectionYears ?? 5, 3, 15)),
      reasoning: typeof parsed.reasoning === "string" ? parsed.reasoning : "未提供说明",
    };

    return NextResponse.json(advice);
  } catch (err) {
    const { message, status } = mapAdviceError(err);
    return NextResponse.json({ error: "获取专家意见失败：" + message }, { status });
  }
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}
