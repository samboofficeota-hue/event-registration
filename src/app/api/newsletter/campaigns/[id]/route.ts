import { NextRequest, NextResponse } from "next/server";
import { getD1 } from "@/lib/d1";
import { verifyAdminRequest } from "@/lib/auth";

// GET /api/newsletter/campaigns/[id]
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ok = await verifyAdminRequest(request);
  if (!ok) return NextResponse.json({ error: "認証が必要です" }, { status: 401 });

  const { id } = await params;
  try {
    const db = await getD1();
    const row = await db.prepare(
      `SELECT * FROM newsletter_campaigns WHERE id = ?`
    ).bind(id).first() as any;

    if (!row) return NextResponse.json({ error: "見つかりません" }, { status: 404 });

    return NextResponse.json({
      ...row,
      recipient_tags: JSON.parse(row.recipient_tags || "[]"),
    });
  } catch (error) {
    console.error("[newsletter/campaigns/[id]] GET error:", error);
    return NextResponse.json({ error: "取得に失敗しました" }, { status: 500 });
  }
}

// PUT /api/newsletter/campaigns/[id] — 更新（下書き保存）
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ok = await verifyAdminRequest(request);
  if (!ok) return NextResponse.json({ error: "認証が必要です" }, { status: 401 });

  const { id } = await params;
  try {
    const body = await request.json();
    const { subject, body: emailBody, recipient_tags, scheduled_at, status } = body;

    const db = await getD1();
    const now = new Date().toISOString();

    // scheduled_at が指定されている場合は予約配信として status を 'scheduled' に設定
    const newStatus = status ?? (scheduled_at ? "scheduled" : undefined);

    const setClauses = [
      "subject = ?", "body = ?", "recipient_tags = ?", "updated_at = ?",
      "scheduled_at = ?",
      ...(newStatus ? ["status = ?"] : []),
    ].join(", ");

    const bindValues = [
      subject, emailBody, JSON.stringify(recipient_tags ?? []), now,
      scheduled_at ?? null,
      ...(newStatus ? [newStatus] : []),
      id,
    ];

    await db.prepare(
      `UPDATE newsletter_campaigns SET ${setClauses} WHERE id = ? AND status IN ('draft', 'scheduled')`
    ).bind(...bindValues).run();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[newsletter/campaigns/[id]] PUT error:", error);
    return NextResponse.json({ error: "更新に失敗しました" }, { status: 500 });
  }
}
