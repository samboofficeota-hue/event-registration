import { getD1 } from "@/lib/d1";

const SCHEDULE_OFFSETS: Record<string, number> = {
  reminder_30: -30,
  reminder_7:  -7,
  reminder_1:  -1,
  followup_1:  +1,
};

function calcScheduledDate(seminarDate: string, offsetDays: number): string {
  const d = new Date(seminarDate);
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

/**
 * セミナー日付から4つのメール配信スケジュールを自動生成/更新する。
 * 既存の pending スケジュールは日付を再計算、sent/failed はスキップ。
 * エラーが発生しても呼び出し元には影響しない（ログのみ）。
 */
export async function generateEmailSchedules(seminarId: string, seminarDate: string): Promise<void> {
  try {
    const db = await getD1();
    const now = new Date().toISOString();

    for (const [templateId, offset] of Object.entries(SCHEDULE_OFFSETS)) {
      const scheduledDate = calcScheduledDate(seminarDate, offset);

      const existing = await db.prepare(
        "SELECT id, status FROM email_schedules WHERE seminar_id = ? AND template_id = ?"
      ).bind(seminarId, templateId).first<{ id: number; status: string }>();

      if (existing) {
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
        ).bind(seminarId, templateId, scheduledDate, now, now).run();
      }
    }
  } catch (error) {
    console.error("[generateEmailSchedules] error:", error);
  }
}
