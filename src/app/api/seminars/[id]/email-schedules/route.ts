import { NextRequest, NextResponse } from "next/server";
import { getD1, getSeminarByIdFromD1 } from "@/lib/d1";
import type { EmailSchedule } from "@/lib/d1";
import { verifyAdminRequest } from "@/lib/auth";

// タイミング定義: template_id -> オフセット日数
const SCHEDULE_OFFSETS: Record<string, number> = {
  // 【予約者向け】
  reminder_30: -14, // 2週間前リマインド
  reminder_7:  -7,
  reminder_1:  -1,
  followup_1:  +1,
  // 【告知集客用】
  announce_30: -30,
  announce_14: -14,
  announce_7:  -7,
};

function calcScheduledDate(seminarDate: string, offsetDays: number): string {
  const d = new Date(seminarDate);
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10); // YYYY-MM-DD
}

// GET /api/seminars/[id]/email-schedules
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ok = await verifyAdminRequest(request);
  if (!ok) return NextResponse.json({ error: "認証が必要です" }, { status: 401 });

  try {
    const { id } = await params;
    const db = await getD1();
    const raw = await db.prepare(
      "SELECT * FROM email_schedules WHERE seminar_id = ? ORDER BY scheduled_date"
    ).bind(id).all() as any;
    const results = (raw.results ?? []) as EmailSchedule[];

    return NextResponse.json(results);
  } catch (error) {
    console.error("[EmailSchedules] GET error:", error);
    return NextResponse.json({ error: "スケジュールの取得に失敗しました" }, { status: 500 });
  }
}

// POST /api/seminars/[id]/email-schedules
// セミナー日付から4つのスケジュールを自動生成する。
// 既存のスケジュールがある場合は pending のものだけ日付を再計算する。
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ok = await verifyAdminRequest(request);
  if (!ok) return NextResponse.json({ error: "認証が必要です" }, { status: 401 });

  try {
    const { id } = await params;

    // セミナー情報の取得（D1）
    const seminar = await getSeminarByIdFromD1(id);
    if (!seminar) {
      return NextResponse.json({ error: "セミナーが見つかりません" }, { status: 404 });
    }

    if (!seminar.date) {
      return NextResponse.json({ error: "セミナーの開催日が未設定です" }, { status: 400 });
    }

    const db = await getD1();
    const now = new Date().toISOString();

    for (const [templateId, offset] of Object.entries(SCHEDULE_OFFSETS)) {
      const scheduledDate = calcScheduledDate(seminar.date, offset);

      // 既存レコード確認
      const existing = (await db.prepare(
        "SELECT id, status FROM email_schedules WHERE seminar_id = ? AND template_id = ?"
      ).bind(id, templateId).first() as any) as { id: number; status: string } | null;

      if (existing) {
        // pending のみ日付を再計算
        if (existing.status === "pending") {
          await db.prepare(
            "UPDATE email_schedules SET scheduled_date = ?, updated_at = ? WHERE id = ?"
          ).bind(scheduledDate, now, existing.id).run();
        }
      } else {
        await db.prepare(
          `INSERT INTO email_schedules
           (seminar_id, template_id, scheduled_date, send_time, enabled, status, created_at, updated_at)
           VALUES (?, ?, ?, '10:00', 1, 'pending', ?, ?)`
        ).bind(id, templateId, scheduledDate, now, now).run();
      }
    }

    const raw2 = await db.prepare(
      "SELECT * FROM email_schedules WHERE seminar_id = ? ORDER BY scheduled_date"
    ).bind(id).all() as any;
    const results2 = (raw2.results ?? []) as EmailSchedule[];

    return NextResponse.json(results2);
  } catch (error) {
    console.error("[EmailSchedules] POST error:", error);
    return NextResponse.json({ error: "スケジュールの生成に失敗しました" }, { status: 500 });
  }
}
