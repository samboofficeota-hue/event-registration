import { NextRequest, NextResponse } from "next/server";
import { getD1 } from "@/lib/d1";
import { verifyAdminRequest } from "@/lib/auth";

// GET /api/newsletter/lists/[id]
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
      `SELECT * FROM newsletter_lists WHERE id = ?`
    ).bind(id).first() as any;

    if (!row) return NextResponse.json({ error: "見つかりません" }, { status: 404 });

    return NextResponse.json({ ...row, conditions: JSON.parse(row.conditions || "[]") });
  } catch (error) {
    console.error("[newsletter/lists/[id]] GET error:", error);
    return NextResponse.json({ error: "取得に失敗しました" }, { status: 500 });
  }
}

// PUT /api/newsletter/lists/[id]
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ok = await verifyAdminRequest(request);
  if (!ok) return NextResponse.json({ error: "認証が必要です" }, { status: 401 });

  const { id } = await params;
  try {
    const body = await request.json();
    const { name, description, conditions, preview_count } = body;
    const db = await getD1();
    const now = new Date().toISOString();

    await db.prepare(
      `UPDATE newsletter_lists
       SET name = ?, description = ?, conditions = ?, preview_count = ?, updated_at = ?
       WHERE id = ?`
    ).bind(
      name ?? "",
      description ?? "",
      JSON.stringify(conditions ?? []),
      preview_count ?? 0,
      now,
      id
    ).run();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[newsletter/lists/[id]] PUT error:", error);
    return NextResponse.json({ error: "更新に失敗しました" }, { status: 500 });
  }
}

// DELETE /api/newsletter/lists/[id]
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ok = await verifyAdminRequest(request);
  if (!ok) return NextResponse.json({ error: "認証が必要です" }, { status: 401 });

  const { id } = await params;
  try {
    const db = await getD1();
    await db.prepare(`DELETE FROM newsletter_lists WHERE id = ?`).bind(id).run();
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[newsletter/lists/[id]] DELETE error:", error);
    return NextResponse.json({ error: "削除に失敗しました" }, { status: 500 });
  }
}
