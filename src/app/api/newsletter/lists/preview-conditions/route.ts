import { NextRequest, NextResponse } from "next/server";
import { getD1 } from "@/lib/d1";
import { verifyAdminRequest } from "@/lib/auth";
import { resolveListConditions } from "@/lib/newsletter/list-resolver";

// POST /api/newsletter/lists/preview-conditions
// 未保存のリスト条件をプレビューする（list_id 不要）
export async function POST(request: NextRequest) {
  const ok = await verifyAdminRequest(request);
  if (!ok) return NextResponse.json({ error: "認証が必要です" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const { conditions = [] } = body;

  try {
    const db = await getD1();
    const result = await resolveListConditions(db, conditions, 5);
    return NextResponse.json(result);
  } catch (error) {
    console.error("[newsletter/lists/preview-conditions] error:", error);
    return NextResponse.json({ error: "プレビューに失敗しました" }, { status: 500 });
  }
}
