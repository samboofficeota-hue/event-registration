import { NextRequest, NextResponse } from "next/server";
import { getD1 } from "@/lib/d1";
import type { EmailSchedule, EmailTemplate } from "@/lib/d1";
import { executeBulkSend } from "@/lib/email/bulk";

// POST /api/email-schedules/process
// Cloudflare Workers の Cron Trigger から呼び出される。
// 本日送信すべき有効なスケジュールを全て処理する。
//
// セキュリティ: CRON_SECRET 環境変数と Authorization ヘッダーで保護する。
// wrangler.toml の [triggers] crons から呼び出す場合はヘッダー不要
// （外部からの不正アクセスを防ぐため Secret を設定することを推奨）
export async function POST(request: NextRequest) {
  // CRON_SECRET による簡易認証（設定されている場合のみ検証）
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    const db = await getD1();

    // 現在時刻（JST: UTC+9）
    const nowUtc = new Date();
    const jstOffset = 9 * 60 * 60 * 1000;
    const nowJst = new Date(nowUtc.getTime() + jstOffset);
    const todayJst = nowJst.toISOString().slice(0, 10);
    const currentTimeJst = `${String(nowJst.getUTCHours()).padStart(2, "0")}:${String(nowJst.getUTCMinutes()).padStart(2, "0")}`;

    // 本日送信すべき pending かつ enabled かつ send_time が現在時刻以前のスケジュールを取得
    const rawDue = await db.prepare(
      `SELECT * FROM email_schedules
       WHERE scheduled_date = ? AND status = 'pending' AND enabled = 1
         AND send_time <= ?
       ORDER BY seminar_id, template_id`
    ).bind(todayJst, currentTimeJst).all() as any;
    const dueSschedules = (rawDue.results ?? []) as EmailSchedule[];

    if (dueSschedules.length === 0) {
      return NextResponse.json({ message: "本日送信対象のスケジュールはありません", processed: 0 });
    }

    const processed: Array<{
      schedule_id: number;
      seminar_id: string;
      template_id: string;
      total: number;
      success: number;
      failed: number;
    }> = [];

    for (const schedule of dueSschedules) {
      const template = (await db.prepare(
        "SELECT * FROM email_templates WHERE id = ?"
      ).bind(schedule.template_id).first() as any) as EmailTemplate | null;

      if (!template) {
        console.error(`[Cron] Template not found: ${schedule.template_id}`);
        continue;
      }

      try {
        const result = await executeBulkSend(db, schedule, template, schedule.seminar_id);
        processed.push({
          schedule_id: schedule.id,
          seminar_id: schedule.seminar_id,
          template_id: schedule.template_id,
          total: result.total,
          success: result.success,
          failed: result.failed,
        });
        console.log(
          `[Cron] Sent schedule ${schedule.id} (${schedule.template_id}): ${result.success}/${result.total} success`
        );
      } catch (err) {
        console.error(`[Cron] Failed to process schedule ${schedule.id}:`, err);
      }
    }

    return NextResponse.json({
      message: "処理完了",
      date: todayJst,
      processed: processed.length,
      details: processed,
    });
  } catch (error) {
    console.error("[Cron] Process error:", error);
    return NextResponse.json({ error: "処理中にエラーが発生しました" }, { status: 500 });
  }
}
