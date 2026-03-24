import { Resend } from "resend";
import { d1SeminarToSeminar } from "@/lib/seminars";
import {
  getSeminarByIdFromD1,
  getRegistrationsBySeminarFromD1,
} from "@/lib/d1";
import type { D1Database, EmailTemplate, EmailSchedule } from "@/lib/d1";
import type { Seminar } from "@/lib/types";

// ---------------------------------------------------------------------------
// テンプレート変数の置換
// ---------------------------------------------------------------------------

/**
 * テンプレート文字列内の {{変数名}} を vars の値で置換する。
 */
export function renderTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => vars[key] ?? "");
}

/**
 * セミナー情報から変数マップを生成する。
 * 参加者ごとに異なる値（name）は別途マージして使う。
 */
export function buildSeminarVars(seminar: Seminar): Record<string, string> {
  const date = seminar.date ? new Date(seminar.date) : null;
  const dateStr = date
    ? `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日 (${["日", "月", "火", "水", "木", "金", "土"][date.getDay()]}) ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`
    : "";

  const formatMap: Record<string, string> = {
    online: "オンライン",
    venue: "会場",
    hybrid: "ハイブリッド",
  };

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
  const meetUrlLine = seminar.meet_url
    ? `Meet URL：${seminar.meet_url}`
    : "";

  return {
    seminar_title: seminar.title ?? "",
    date: dateStr,
    format: formatMap[seminar.format ?? "online"] ?? "オンライン",
    speaker: seminar.speaker ?? "",
    description: seminar.description ?? "",
    meet_url_line: meetUrlLine,
    registration_url: `${appUrl}/seminars/${seminar.id}`,
    survey_url: `${appUrl}/seminars/${seminar.id}/survey`,
    from_email: process.env.RESEND_FROM_EMAIL ?? "",
  };
}

// ---------------------------------------------------------------------------
// 参加者の取得（個別スプシの「予約情報」シートから）
// ---------------------------------------------------------------------------

export interface Participant {
  name: string;
  email: string;
}

/**
 * セミナーIDから有効な参加者一覧を D1 より取得する。
 * ステータスが cancelled 以外の行を対象とする。
 */
export async function getParticipants(seminarId: string): Promise<Participant[]> {
  const rows = await getRegistrationsBySeminarFromD1(seminarId);
  return rows
    .filter((r) => r.email && r.status !== "cancelled")
    .map((r) => ({ name: r.name, email: r.email }));
}

// ---------------------------------------------------------------------------
// 一斉メール送信
// ---------------------------------------------------------------------------

export interface BulkSendResult {
  total: number;
  success: number;
  failed: number;
  logs: Array<{
    recipient_email: string;
    recipient_name: string;
    status: "sent" | "failed";
    resend_id?: string;
    error_message?: string;
  }>;
}

/**
 * スケジュールに基づいて参加者全員にメールを一斉送信し、ログを D1 に記録する。
 */
export async function executeBulkSend(
  db: D1Database,
  schedule: EmailSchedule,
  template: EmailTemplate,
  seminarId: string,
  tenant?: string | null
): Promise<BulkSendResult> {
  // セミナー情報の取得（D1）
  const seminarRow = await getSeminarByIdFromD1(seminarId);
  if (!seminarRow) {
    throw new Error(`セミナーが見つかりません: ${seminarId}`);
  }
  const seminar = d1SeminarToSeminar(seminarRow);

  // 参加者リストの取得（D1）
  const participants = await getParticipants(seminarId);

  if (participants.length === 0) {
    return { total: 0, success: 0, failed: 0, logs: [] };
  }

  // Resend 初期化
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("RESEND_API_KEY is not set");
  const resend = new Resend(apiKey);

  const fromEmail = process.env.RESEND_FROM_EMAIL ?? "noreply@events.allianceforum.org";
  const seminarVars = buildSeminarVars(seminar);

  const result: BulkSendResult = {
    total: participants.length,
    success: 0,
    failed: 0,
    logs: [],
  };

  const now = new Date().toISOString();

  for (const participant of participants) {
    const vars = { ...seminarVars, name: participant.name };
    const subject = renderTemplate(template.subject, vars);
    const text = renderTemplate(template.body, vars);

    // 改行を <br> に変換してシンプルな HTML メールにする
    const html = `<pre style="font-family:sans-serif;white-space:pre-wrap;line-height:1.7">${text}</pre>`;

    try {
      const { data, error } = await resend.emails.send({
        from: `WHGC ゲームチェンジャーズ・フォーラム <${fromEmail}>`,
        to: participant.email,
        subject,
        html,
      });

      if (error) throw new Error(error.message);

      result.success++;
      result.logs.push({
        recipient_email: participant.email,
        recipient_name: participant.name,
        status: "sent",
        resend_id: data?.id,
      });

      // D1 にログ記録
      await db.prepare(
        `INSERT INTO email_send_logs
         (schedule_id, seminar_id, recipient_email, recipient_name, status, resend_id, sent_at)
         VALUES (?, ?, ?, ?, 'sent', ?, ?)`
      ).bind(schedule.id, seminarId, participant.email, participant.name, data?.id ?? null, now).run();

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      result.failed++;
      result.logs.push({
        recipient_email: participant.email,
        recipient_name: participant.name,
        status: "failed",
        error_message: errorMessage,
      });

      await db.prepare(
        `INSERT INTO email_send_logs
         (schedule_id, seminar_id, recipient_email, recipient_name, status, error_message, sent_at)
         VALUES (?, ?, ?, ?, 'failed', ?, ?)`
      ).bind(schedule.id, seminarId, participant.email, participant.name, errorMessage, now).run();
    }
  }

  // スケジュールのステータスを更新
  const finalStatus = result.failed === 0 ? "sent" : result.success > 0 ? "sent" : "failed";
  await db.prepare(
    `UPDATE email_schedules SET status = ?, sent_at = ?, updated_at = ? WHERE id = ?`
  ).bind(finalStatus, now, now, schedule.id).run();

  return result;
}
