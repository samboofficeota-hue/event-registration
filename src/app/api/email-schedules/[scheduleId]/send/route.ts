import { NextRequest, NextResponse } from "next/server";
import { getD1 } from "@/lib/d1";
import type { EmailSchedule, EmailTemplate } from "@/lib/d1";
import { verifyAdminRequest } from "@/lib/auth";
import { executeBulkSend } from "@/lib/email/bulk";

// POST /api/email-schedules/[scheduleId]/send
// 管理者が任意のタイミングで手動送信する。
// tenant を body に含めることでテナント対応。
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ scheduleId: string }> }
) {
  const ok = await verifyAdminRequest(request);
  if (!ok) return NextResponse.json({ error: "認証が必要です" }, { status: 401 });

  try {
    const { scheduleId } = await params;
    const body = await request.json().catch(() => ({}));
    const tenant = body.tenant ?? null;

    const db = await getD1();

    const schedule = await db.prepare(
      "SELECT * FROM email_schedules WHERE id = ?"
    ).bind(Number(scheduleId)).first<EmailSchedule>();

    if (!schedule) {
      return NextResponse.json({ error: "スケジュールが見つかりません" }, { status: 404 });
    }

    if (schedule.status === "sent") {
      return NextResponse.json({ error: "このスケジュールは送信済みです" }, { status: 400 });
    }

    if (!schedule.enabled) {
      return NextResponse.json({ error: "このスケジュールは無効です" }, { status: 400 });
    }

    const template = await db.prepare(
      "SELECT * FROM email_templates WHERE id = ?"
    ).bind(schedule.template_id).first<EmailTemplate>();

    if (!template) {
      return NextResponse.json({ error: "テンプレートが見つかりません" }, { status: 404 });
    }

    const result = await executeBulkSend(db, schedule, template, schedule.seminar_id, tenant);

    return NextResponse.json({
      success: true,
      total: result.total,
      sent: result.success,
      failed: result.failed,
    });
  } catch (error) {
    console.error("[EmailSend] POST error:", error);
    return NextResponse.json({ error: "メール送信に失敗しました" }, { status: 500 });
  }
}
