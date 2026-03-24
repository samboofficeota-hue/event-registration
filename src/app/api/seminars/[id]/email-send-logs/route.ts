import { NextRequest, NextResponse } from "next/server";
import { getD1 } from "@/lib/d1";
import type { EmailSendLog } from "@/lib/d1";
import { verifyAdminRequest } from "@/lib/auth";

// GET /api/seminars/[id]/email-send-logs
// スケジュールIDでフィルタリングも可能: ?schedule_id=123
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ok = await verifyAdminRequest(request);
  if (!ok) return NextResponse.json({ error: "認証が必要です" }, { status: 401 });

  try {
    const { id } = await params;
    const scheduleId = new URL(request.url).searchParams.get("schedule_id");
    const db = await getD1();

    let query = "SELECT * FROM email_send_logs WHERE seminar_id = ?";
    const binds: (string | number)[] = [id];

    if (scheduleId) {
      query += " AND schedule_id = ?";
      binds.push(Number(scheduleId));
    }
    query += " ORDER BY sent_at DESC";

    const { results } = await db.prepare(query).bind(...binds).all<EmailSendLog>();
    return NextResponse.json(results);
  } catch (error) {
    console.error("[EmailSendLogs] GET error:", error);
    return NextResponse.json({ error: "送信ログの取得に失敗しました" }, { status: 500 });
  }
}
