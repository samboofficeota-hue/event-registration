import { NextRequest, NextResponse } from "next/server";
import { getD1 } from "@/lib/d1";
import { verifyAdminRequest } from "@/lib/auth";

// GET /api/newsletter/stats — 送信統計を返す
export async function GET(request: NextRequest) {
  const ok = await verifyAdminRequest(request);
  if (!ok) return NextResponse.json({ error: "認証が必要です" }, { status: 401 });

  try {
    const db = await getD1();

    // 今日・今月の基準日（JST: UTC+9）
    const nowUtc = new Date();
    const jstOffset = 9 * 60 * 60 * 1000;
    const nowJst = new Date(nowUtc.getTime() + jstOffset);
    const todayJst = nowJst.toISOString().slice(0, 10); // YYYY-MM-DD
    const monthStartJst = `${nowJst.toISOString().slice(0, 7)}-01`; // YYYY-MM-01

    // 今日の送信数（セミナーメール + メルマガ合計）
    const todayResult = await db.prepare(
      `SELECT
         COUNT(*) AS total,
         SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) AS sent,
         SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) AS failed
       FROM newsletter_send_logs
       WHERE sent_at >= ?`
    ).bind(`${todayJst}T00:00:00.000Z`).first() as any;

    // 今月の送信数
    const monthResult = await db.prepare(
      `SELECT
         COUNT(*) AS total,
         SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) AS sent,
         SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) AS failed
       FROM newsletter_send_logs
       WHERE sent_at >= ?`
    ).bind(`${monthStartJst}T00:00:00.000Z`).first() as any;

    // セミナーメール（email_send_logs）の今月分も合算
    const seminarMonthResult = await db.prepare(
      `SELECT
         COUNT(*) AS total,
         SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) AS sent
       FROM email_send_logs
       WHERE sent_at >= ?`
    ).bind(`${monthStartJst}T00:00:00.000Z`).first() as any;

    const seminarTodayResult = await db.prepare(
      `SELECT COUNT(*) AS total
       FROM email_send_logs
       WHERE sent_at >= ?`
    ).bind(`${todayJst}T00:00:00.000Z`).first() as any;

    // RESEND_PLAN=pro で Pro プランの上限を使用（デフォルト: free）
    const plan = (process.env.RESEND_PLAN ?? "free").toLowerCase();
    const limits = plan === "pro"
      ? { daily: null, monthly: 50000, plan: "Pro" }   // Pro: 日次制限なし
      : { daily: 100, monthly: 3000, plan: "Free" };    // Free: 日100・月3,000

    return NextResponse.json({
      today: {
        total: (todayResult?.total ?? 0) + (seminarTodayResult?.total ?? 0),
        newsletter: todayResult?.total ?? 0,
        seminar: seminarTodayResult?.total ?? 0,
      },
      month: {
        total: (monthResult?.total ?? 0) + (seminarMonthResult?.total ?? 0),
        newsletter_sent: monthResult?.sent ?? 0,
        newsletter_failed: monthResult?.failed ?? 0,
        seminar_sent: seminarMonthResult?.sent ?? 0,
      },
      limits,
    });
  } catch (error) {
    console.error("[newsletter/stats] GET error:", error);
    return NextResponse.json({ error: "取得に失敗しました" }, { status: 500 });
  }
}
