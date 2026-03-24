import { NextRequest, NextResponse } from "next/server";
import { getD1 } from "@/lib/d1";
import type { EmailSchedule } from "@/lib/d1";
import { verifyAdminRequest } from "@/lib/auth";

// PATCH /api/seminars/[id]/email-schedules/[scheduleId]
// enabled / scheduled_date / send_time を更新できる。
// status が sent / failed のスケジュールは変更不可。
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; scheduleId: string }> }
) {
  const ok = await verifyAdminRequest(request);
  if (!ok) return NextResponse.json({ error: "認証が必要です" }, { status: 401 });

  try {
    const { id, scheduleId } = await params;
    const body = await request.json();
    const db = await getD1();

    const existing = await db.prepare(
      "SELECT * FROM email_schedules WHERE id = ? AND seminar_id = ?"
    ).bind(Number(scheduleId), id).first<EmailSchedule>();

    if (!existing) {
      return NextResponse.json({ error: "スケジュールが見つかりません" }, { status: 404 });
    }

    if (existing.status === "sent") {
      return NextResponse.json({ error: "送信済みのスケジュールは変更できません" }, { status: 400 });
    }

    const now = new Date().toISOString();
    const enabled = body.enabled !== undefined ? (body.enabled ? 1 : 0) : existing.enabled;
    const scheduledDate = body.scheduled_date ?? existing.scheduled_date;
    const sendTime = body.send_time ?? existing.send_time;

    await db.prepare(
      `UPDATE email_schedules
       SET enabled = ?, scheduled_date = ?, send_time = ?, updated_at = ?
       WHERE id = ?`
    ).bind(enabled, scheduledDate, sendTime, now, existing.id).run();

    const updated = await db.prepare(
      "SELECT * FROM email_schedules WHERE id = ?"
    ).bind(existing.id).first<EmailSchedule>();

    return NextResponse.json(updated);
  } catch (error) {
    console.error("[EmailSchedules] PATCH error:", error);
    return NextResponse.json({ error: "スケジュールの更新に失敗しました" }, { status: 500 });
  }
}
