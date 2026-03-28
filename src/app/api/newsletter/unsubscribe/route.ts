import { NextRequest, NextResponse } from "next/server";
import { getD1 } from "@/lib/d1";

// POST /api/newsletter/unsubscribe
// 配信停止処理（認証不要 — subscriber_id は UUID で推測困難）
// Body: { id: string }
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const { id } = body;

  if (!id || typeof id !== "string") {
    return NextResponse.json({ error: "無効なリクエストです" }, { status: 400 });
  }

  try {
    const db = await getD1();
    const now = new Date().toISOString();

    const row = await db.prepare(
      `SELECT id, email, status FROM newsletter_subscribers WHERE id = ?`
    ).bind(id).first() as any;

    if (!row) {
      return NextResponse.json({ error: "登録情報が見つかりません" }, { status: 404 });
    }

    if (row.status === "unsubscribed") {
      return NextResponse.json({ success: true, already: true, email: row.email });
    }

    await db.prepare(
      `UPDATE newsletter_subscribers SET status = 'unsubscribed', updated_at = ? WHERE id = ?`
    ).bind(now, id).run();

    return NextResponse.json({ success: true, email: row.email });
  } catch (error) {
    console.error("[newsletter/unsubscribe] error:", error);
    return NextResponse.json({ error: "処理に失敗しました" }, { status: 500 });
  }
}
