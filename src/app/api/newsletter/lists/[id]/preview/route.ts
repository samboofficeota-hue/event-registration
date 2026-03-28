import { NextRequest, NextResponse } from "next/server";
import { getD1 } from "@/lib/d1";
import { verifyAdminRequest } from "@/lib/auth";
import { resolveListConditions } from "@/lib/newsletter/list-resolver";

// POST /api/newsletter/lists/[id]/preview
// 条件に一致する購読者数とサンプルを返す。list_id が指定されない場合は body.conditions で直接解決。
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ok = await verifyAdminRequest(request);
  if (!ok) return NextResponse.json({ error: "認証が必要です" }, { status: 401 });

  const { id } = await params;
  const body = await request.json().catch(() => ({}));

  try {
    const db = await getD1();

    // conditions: body に直接含まれるか、DB から取得
    let conditions = body.conditions;
    if (!conditions) {
      const row = await db.prepare(`SELECT conditions FROM newsletter_lists WHERE id = ?`).bind(id).first() as any;
      if (!row) return NextResponse.json({ error: "見つかりません" }, { status: 404 });
      conditions = JSON.parse(row.conditions || "[]");
    }

    const result = await resolveListConditions(db, conditions, 5);

    // プレビュー件数を更新（新規プレビューの場合のみ）
    if (!body.conditions) {
      await db.prepare(
        `UPDATE newsletter_lists SET preview_count = ?, updated_at = ? WHERE id = ?`
      ).bind(result.count, new Date().toISOString(), id).run();
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("[newsletter/lists/[id]/preview] error:", error);
    return NextResponse.json({ error: "プレビューに失敗しました" }, { status: 500 });
  }
}
