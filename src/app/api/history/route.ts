import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

/** 获取所有已保存的分析结果 */
export async function GET() {
  const sb = getSupabase();
  if (!sb) {
    return NextResponse.json(
      { error: "Supabase 未配置，请检查环境变量。" },
      { status: 503 }
    );
  }

  const { data, error } = await sb
    .from("ticker_analyses")
    .select("*")
    .order("updated_at", { ascending: false });

  if (error) {
    return NextResponse.json(
      { error: "获取历史记录失败：" + error.message },
      { status: 502 }
    );
  }

  return NextResponse.json(data ?? []);
}
