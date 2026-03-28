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
    const { subject, body: emailBody, recipient_tags, scheduled_at, status, header_color, list_id } = body;

    const db = await getD1();
    const now = new Date().toISOString();

    // scheduled_at が指定されている場合は予約配信として status を 'scheduled' に設定
    const newStatus = status ?? ("scheduled_at" in body && scheduled_at ? "scheduled" : undefined);

    // 送信されたフィールドのみ更新する（部分更新対応）
    const setClauses: string[] = ["updated_at = ?"];
    const bindValues: unknown[] = [now];

    if ("subject" in body)       { setClauses.push("subject = ?");        bindValues.push(subject); }
    if ("body" in body)          { setClauses.push("body = ?");           bindValues.push(emailBody); }
    if ("recipient_tags" in body){ setClauses.push("recipient_tags = ?"); bindValues.push(JSON.stringify(recipient_tags ?? [])); }
    if ("scheduled_at" in body)  { setClauses.push("scheduled_at = ?");   bindValues.push(scheduled_at ?? null); }
    if ("header_color" in body)  { setClauses.push("header_color = ?");   bindValues.push(header_color ?? "dark"); }
    if ("list_id" in body)       { setClauses.push("list_id = ?");        bindValues.push(list_id ?? null); }
    if (newStatus)               { setClauses.push("status = ?");         bindValues.push(newStatus); }

    bindValues.push(id);

    await db.prepare(
      `UPDATE newsletter_campaigns SET ${setClauses.join(", ")} WHERE id = ? AND status IN ('draft', 'scheduled')`
    ).bind(...bindValues).run();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[newsletter/campaigns/[id]] PUT error:", error);
    return NextResponse.json({ error: "更新に失敗しました" }, { status: 500 });
  }
}
