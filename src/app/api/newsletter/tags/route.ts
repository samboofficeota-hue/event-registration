import { NextRequest, NextResponse } from "next/server";
import { getD1 } from "@/lib/d1";
import { verifyAdminRequest } from "@/lib/auth";

// GET /api/newsletter/tags — 使用中のタグ一覧と件数
export async function GET(request: NextRequest) {
  const ok = await verifyAdminRequest(request);
  if (!ok) return NextResponse.json({ error: "認証が必要です" }, { status: 401 });

  try {
    const db = await getD1();
    const rows = await db.prepare(
      `SELECT tag, COUNT(*) as count
       FROM newsletter_tags t
       JOIN newsletter_subscribers s ON s.id = t.subscriber_id AND s.status = 'active'
       GROUP BY tag ORDER BY count DESC, tag ASC`
    ).all();
    return NextResponse.json(rows.results);
  } catch (error) {
    console.error("[Newsletter/Tags] GET error:", error);
    return NextResponse.json({ error: "取得に失敗しました" }, { status: 500 });
  }
}
