import { NextRequest, NextResponse } from "next/server";
import { getD1 } from "@/lib/d1";
import { verifyAdminRequest } from "@/lib/auth";

// PATCH /api/newsletter/subscribers/[id]
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ok = await verifyAdminRequest(request);
  if (!ok) return NextResponse.json({ error: "認証が必要です" }, { status: 401 });

  try {
    const { id } = await params;
    const body = await request.json();
    const db = await getD1();
    const now = new Date().toISOString();

    const allowed = ["name", "company", "department", "phone", "note", "status", "source"];
    const fields = Object.keys(body).filter((k) => allowed.includes(k));

    if (fields.length === 0 && !body.tags) {
      return NextResponse.json({ error: "更新フィールドがありません" }, { status: 400 });
    }

    if (fields.length > 0) {
      const setClauses = [...fields.map((f) => `${f} = ?`), "updated_at = ?"].join(", ");
      const values = [...fields.map((f) => body[f]), now, id];
      await db.prepare(`UPDATE newsletter_subscribers SET ${setClauses} WHERE id = ?`).bind(...values).run();
    }

    // タグの更新（差し替え）
    if (Array.isArray(body.tags)) {
      await db.prepare("DELETE FROM newsletter_tags WHERE subscriber_id = ?").bind(id).run();
      for (const tag of body.tags as string[]) {
        if (tag.trim()) {
          await db.prepare(
            `INSERT OR IGNORE INTO newsletter_tags (subscriber_id, tag, created_at) VALUES (?, ?, ?)`
          ).bind(id, tag.trim(), now).run();
        }
      }
    }

    const updated = await db.prepare(
      `SELECT s.*, (SELECT GROUP_CONCAT(t.tag, ',') FROM newsletter_tags t WHERE t.subscriber_id = s.id) as tags
       FROM newsletter_subscribers s WHERE s.id = ?`
    ).bind(id).first() as Record<string, unknown> | null;

    if (!updated) return NextResponse.json({ error: "見つかりません" }, { status: 404 });

    return NextResponse.json({
      ...updated,
      tags: updated.tags ? String(updated.tags).split(",").filter(Boolean) : [],
    });
  } catch (error) {
    console.error("[Newsletter/Subscriber] PATCH error:", error);
    return NextResponse.json({ error: "更新に失敗しました" }, { status: 500 });
  }
}

// DELETE /api/newsletter/subscribers/[id]
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ok = await verifyAdminRequest(request);
  if (!ok) return NextResponse.json({ error: "認証が必要です" }, { status: 401 });

  try {
    const { id } = await params;
    const db = await getD1();
    await db.prepare("DELETE FROM newsletter_subscribers WHERE id = ?").bind(id).run();
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Newsletter/Subscriber] DELETE error:", error);
    return NextResponse.json({ error: "削除に失敗しました" }, { status: 500 });
  }
}
