import { getD1 } from "@/lib/d1";

// 【予約者向け】template_id -> オフセット日数
export const REGISTRANT_OFFSETS: Record<string, number> = {
  reminder_30: -14, // 2週間前リマインド（旧: 30日前）
  reminder_7:  -7,
  reminder_1:  -1,
  followup_1:  +1,
};

// 【告知集客用】template_id -> オフセット日数
export const ANNOUNCE_OFFSETS: Record<string, number> = {
  announce_30: -30,
  announce_14: -14,
  announce_7:  -7,
};

// 全オフセット
const SCHEDULE_OFFSETS: Record<string, number> = {
  ...REGISTRANT_OFFSETS,
  ...ANNOUNCE_OFFSETS,
};

function calcScheduledDate(seminarDate: string, offsetDays: number): string {
  const d = new Date(seminarDate);
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

/**
 * セミナー日付から7つのメール配信スケジュールを自動生成/更新する。
 * 【予約者向け】4種 + 【告知集客用】3種
 * 既存の pending スケジュールは日付を再計算、sent/failed はスキップ。
 */
export async function generateEmailSchedules(seminarId: string, seminarDate: string): Promise<void> {
  try {
    const db = await getD1();
    const now = new Date().toISOString();

    for (const [templateId, offset] of Object.entries(SCHEDULE_OFFSETS)) {
      const scheduledDate = calcScheduledDate(seminarDate, offset);

      const existing = (await db.prepare(
        "SELECT id, status FROM email_schedules WHERE seminar_id = ? AND template_id = ?"
      ).bind(seminarId, templateId).first() as any) as { id: number; status: string } | null;

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
