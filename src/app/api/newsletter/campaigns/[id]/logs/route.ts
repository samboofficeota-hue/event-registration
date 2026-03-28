import { NextRequest, NextResponse } from "next/server";
import { getD1 } from "@/lib/d1";
import { verifyAdminRequest } from "@/lib/auth";

// GET /api/newsletter/campaigns/[id]/logs?page=1&limit=100&status=
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ok = await verifyAdminRequest(request);
  if (!ok) return NextResponse.json({ error: "認証が必要です" }, { status: 401 });

  const { id } = await params;
  const url = new URL(request.url);
  const page   = Math.max(1, Number(url.searchParams.get("page") ?? 1));
  const limit  = Math.min(200, Math.max(1, Number(url.searchParams.get("limit") ?? 100)));
  const status = url.searchParams.get("status") ?? ""; // "sent" | "failed" | ""
  const offset = (page - 1) * limit;

  try {
    const db = await getD1();

    const statusClause = status ? `AND status = '${status === "sent" ? "sent" : "failed"}'` : "";

    const countRow = await db.prepare(
      `SELECT COUNT(*) AS cnt FROM newsletter_send_logs
       WHERE campaign_id = ? ${statusClause}`
    ).bind(id).first() as any;

    const rows = await db.prepare(
      `SELECT id, email, name, status, resend_id, error_message, sent_at
       FROM newsletter_send_logs
       WHERE campaign_id = ? ${statusClause}
       ORDER BY sent_at ASC, id ASC
       LIMIT ? OFFSET ?`
    ).bind(id, limit, offset).all() as any;

    return NextResponse.json({
      total: countRow?.cnt ?? 0,
      page,
      limit,
      logs: rows.results ?? [],
    });
  } catch (error) {
    console.error("[newsletter/campaigns/[id]/logs] GET error:", error);
    return NextResponse.json({ error: "取得に失敗しました" }, { status: 500 });
  }
}
