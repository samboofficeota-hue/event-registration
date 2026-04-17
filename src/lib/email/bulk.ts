import { Resend } from "resend";
import { d1SeminarToSeminar } from "@/lib/seminars";
import {
  getSeminarByIdFromD1,
  getRegistrationsBySeminarFromD1,
} from "@/lib/d1";
import type { D1Database, EmailTemplate, EmailSchedule } from "@/lib/d1";
import type { Seminar } from "@/lib/types";
import { getTheme } from "@/lib/email/themes";
import { BRAND_CONFIGS, detectBrand } from "@/lib/email/brand";

// Re-export for backward compat
export { BRAND_CONFIGS, detectBrand } from "@/lib/email/brand";
export type { BrandKey } from "@/lib/email/brand";

// ---------------------------------------------------------------------------
// テンプレート変数の置換
// ---------------------------------------------------------------------------

export function renderTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => vars[key] ?? "");
}

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
  const meetUrlLine = seminar.meet_url ? `Meet URL：${seminar.meet_url}` : "";
  const endTimeSuffix = seminar.end_time ? ` 〜 ${seminar.end_time}` : "";

  return {
    seminar_title: seminar.title ?? "",
    date: dateStr + endTimeSuffix,
    format: formatMap[seminar.format ?? "online"] ?? "オンライン",
    speaker: seminar.speaker ?? "",
    description: seminar.description ?? "",
    meet_url_line: meetUrlLine,
    registration_url: `${appUrl}/seminars/${seminar.id}`,
    survey_url: `${appUrl}/seminars/${seminar.id}/survey`,
    from_email: "info@whgcforum.org",
  };
}

// ---------------------------------------------------------------------------
// HTML メール生成
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// ブランド設定（brand.ts に移動済み・re-export のみ）
// ---------------------------------------------------------------------------

/**
 * プレーンテキストのメール本文から、レスポンシブ HTML メールを生成する。
 * - URL を自動リンク化
 * - 改行を <br> に変換
 * - ブランド別ヘッダー・フッター付き
 */
export function buildHtmlEmail(text: string, unsubscribeUrl?: string, headerColor?: string, footerText?: string | null): string {
  const theme  = getTheme(headerColor);
  const brand  = BRAND_CONFIGS[detectBrand(footerText)];
  const sender = footerText?.trim() || brand.footerSenderText;

  // HTML 特殊文字をエスケープ
  const escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  // URL を自動リンク化（エスケープ後に適用）
  const withLinks = escaped.replace(
    /(https?:\/\/[^\s&<>"]+)/g,
    '<a href="$1" style="color:#6366f1;text-decoration:underline;word-break:break-all;">$1</a>'
  );

  // 改行を <br> に変換
  const withBreaks = withLinks.replace(/\n/g, "<br>\n");

  const unsubscribeSection = unsubscribeUrl ? `
              <br>配信停止をご希望の方は
              <a href="${unsubscribeUrl}" style="color:#71717a;text-decoration:underline;">こちら</a>
              より停止手続きをお願いいたします。` : "";

  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${brand.headerTitle}</title>
</head>
<body style="margin:0;padding:0;background-color:${theme.bg};font-family:-apple-system,BlinkMacSystemFont,'Hiragino Sans','Hiragino Kaku Gothic ProN',Meiryo,'Yu Gothic',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${theme.bg};padding:32px 16px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.08);">

          <!-- ヘッダー -->
          <tr>
            <td style="background-color:${theme.header};padding:20px 32px;">
              <p style="margin:0;color:#ffffff;font-size:15px;font-weight:600;letter-spacing:0.04em;">
                ${brand.headerTitle}
              </p>
            </td>
          </tr>

          <!-- 本文 -->
          <tr>
            <td style="padding:32px;color:#18181b;font-size:15px;line-height:1.9;">
              ${withBreaks}
            </td>
          </tr>

          <!-- フッター -->
          <tr>
            <td style="padding:20px 32px;background-color:#fafafa;border-top:1px solid #e4e4e7;">
              <p style="margin:0;color:#71717a;font-size:12px;line-height:1.8;">
                ${sender}${unsubscribeSection}<br>
                ご不明な点は <a href="mailto:${brand.contactEmail}" style="color:#71717a;">${brand.contactEmail}</a> までお問い合わせください。
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// ニュースレターリストメンバーへの一斉送信（告知集客用）
// ---------------------------------------------------------------------------

export async function executeListMemberSend(
  db: D1Database,
  scheduleId: number,
  template: EmailTemplate,
  listId: string,
  seminarId: string,
  tenant?: string | null
): Promise<BulkSendResult> {
  const seminarRow = await getSeminarByIdFromD1(seminarId);
  if (!seminarRow) throw new Error(`セミナーが見つかりません: ${seminarId}`);
  const seminar = d1SeminarToSeminar(seminarRow);

  // リストメンバーを全件取得（500件ずつページネーション）
  const allMembers: { id: string; email: string; name: string }[] = [];
  let offset = 0;
  while (true) {
    const res = await db.prepare(
      `SELECT s.id, s.email, s.name
       FROM newsletter_list_members m
       JOIN newsletter_subscribers s ON s.id = m.subscriber_id
       WHERE m.list_id = ? AND s.status = 'active'
       LIMIT 500 OFFSET ?`
    ).bind(listId, offset).all();
    const rows = (res.results ?? []) as { id: string; email: string; name: string }[];
    allMembers.push(...rows);
    if (rows.length < 500) break;
    offset += 500;
  }

  if (allMembers.length === 0) return { total: 0, success: 0, failed: 0, logs: [] };

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("RESEND_API_KEY is not set");
  const { Resend } = await import("resend");
  const resend = new Resend(apiKey);

  const fromEmail = process.env.RESEND_FROM_EMAIL ?? "noreply@events.allianceforum.org";
  const seminarVars = buildSeminarVars(seminar);
  const footerText = template.body?.includes("アライアンス・フォーラム財団") ? undefined : null;
  const brand = BRAND_CONFIGS[detectBrand(footerText)];

  const result: BulkSendResult = { total: allMembers.length, success: 0, failed: 0, logs: [] };
  const now = new Date().toISOString();

  // Resend batch API で100件ずつ送信
  // resend_id が返らなかったメンバーを再送するためのキュー
  const retryQueue: { id: string; email: string; name: string }[] = [];
  const BATCH_SIZE = 100;

  for (let i = 0; i < allMembers.length; i += BATCH_SIZE) {
    const batch = allMembers.slice(i, i + BATCH_SIZE);
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://events.allianceforum.org";
    const messages = batch.map((member) => {
      const vars = { ...seminarVars, name: member.name || "" };
      const subject = renderTemplate(template.subject, vars).replace(/[\r\n]/g, " ").replace(/\\n/g, " ").trim();
      const text = renderTemplate(template.body, vars);
      const unsubscribeUrl = `${appUrl}/unsubscribe?id=${member.id}`;
      const html = buildHtmlEmail(text, unsubscribeUrl);
      return {
        from: `${brand.fromName} <${fromEmail}>`,
        to: member.email,
        subject,
        html,
        text,
      };
    });

    try {
      const { data, error } = await resend.batch.send(messages as any);
      if (error) throw new Error((error as any).message ?? "batch send error");

      const sent = (data as any)?.data ?? [];
      for (let j = 0; j < batch.length; j++) {
        const member = batch[j];
        const resendId = sent[j]?.id ?? null;

        if (resendId) {
          // Resend から ID が返ってきた → 正常送信
          result.success++;
          result.logs.push({ recipient_email: member.email, recipient_name: member.name, status: "sent", resend_id: resendId });
          await db.prepare(
            `INSERT INTO email_send_logs (schedule_id, seminar_id, recipient_email, recipient_name, status, resend_id, sent_at)
             VALUES (?, ?, ?, ?, 'sent', ?, ?)`
          ).bind(scheduleId, seminarId, member.email, member.name, resendId, now).run();
        } else {
          // resend_id が null → Resend に届いていない可能性あり → 再送キューへ
          console.warn(`[executeListMemberSend] resend_id not returned for ${member.email}, queuing for retry`);
          retryQueue.push(member);
        }
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      for (const member of batch) {
        result.failed++;
        result.logs.push({ recipient_email: member.email, recipient_name: member.name, status: "failed", error_message: errorMessage });
        await db.prepare(
          `INSERT INTO email_send_logs (schedule_id, seminar_id, recipient_email, recipient_name, status, error_message, sent_at)
           VALUES (?, ?, ?, ?, 'failed', ?, ?)`
        ).bind(scheduleId, seminarId, member.email, member.name, errorMessage, now).run();
      }
    }
  }

  // バッチで resend_id が取得できなかったメンバーを1件ずつ再送
  if (retryQueue.length > 0) {
    console.log(`[executeListMemberSend] Retrying ${retryQueue.length} emails individually`);
    const retryAppUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://events.allianceforum.org";
    for (const member of retryQueue) {
      const vars = { ...seminarVars, name: member.name || "" };
      const subject = renderTemplate(template.subject, vars).replace(/[\r\n]/g, " ").replace(/\\n/g, " ").trim();
      const text = renderTemplate(template.body, vars);
      const unsubscribeUrl = `${retryAppUrl}/unsubscribe?id=${member.id}`;
      const html = buildHtmlEmail(text, unsubscribeUrl);
      try {
        const { data: retryData, error: retryError } = await resend.emails.send({
          from: `${brand.fromName} <${fromEmail}>`,
          to: member.email,
          subject,
          html,
          text,
        });
        if (retryError) throw new Error(retryError.message);
        result.success++;
        result.logs.push({ recipient_email: member.email, recipient_name: member.name, status: "sent", resend_id: retryData?.id });
        await db.prepare(
          `INSERT INTO email_send_logs (schedule_id, seminar_id, recipient_email, recipient_name, status, resend_id, sent_at)
           VALUES (?, ?, ?, ?, 'sent', ?, ?)`
        ).bind(scheduleId, seminarId, member.email, member.name, retryData?.id ?? null, now).run();
      } catch (retryErr) {
        const errorMessage = retryErr instanceof Error ? retryErr.message : String(retryErr);
        result.failed++;
        result.logs.push({ recipient_email: member.email, recipient_name: member.name, status: "failed", error_message: errorMessage });
        await db.prepare(
          `INSERT INTO email_send_logs (schedule_id, seminar_id, recipient_email, recipient_name, status, error_message, sent_at)
           VALUES (?, ?, ?, ?, 'failed', ?, ?)`
        ).bind(scheduleId, seminarId, member.email, member.name, errorMessage, now).run();
      }
    }
  }

  const finalStatus = result.failed === 0 ? "sent" : result.success > 0 ? "sent" : "failed";
  await db.prepare(
    `UPDATE email_schedules SET status = ?, sent_at = ?, updated_at = ? WHERE id = ?`
  ).bind(finalStatus, now, now, scheduleId).run();

  return result;
}

// ---------------------------------------------------------------------------
// 参加者の取得
// ---------------------------------------------------------------------------

export interface Participant {
  name: string;
  email: string;
}

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

export async function executeBulkSend(
  db: D1Database,
  schedule: EmailSchedule,
  template: EmailTemplate,
  seminarId: string,
  tenant?: string | null
): Promise<BulkSendResult> {
  const seminarRow = await getSeminarByIdFromD1(seminarId);
  if (!seminarRow) throw new Error(`セミナーが見つかりません: ${seminarId}`);
  const seminar = d1SeminarToSeminar(seminarRow);

  const participants = await getParticipants(seminarId);
  if (participants.length === 0) return { total: 0, success: 0, failed: 0, logs: [] };

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("RESEND_API_KEY is not set");
  const resend = new Resend(apiKey);

  const fromEmail = process.env.RESEND_FROM_EMAIL ?? "noreply@events.allianceforum.org";
  const seminarVars = buildSeminarVars(seminar);

  const result: BulkSendResult = { total: participants.length, success: 0, failed: 0, logs: [] };
  const now = new Date().toISOString();

  for (const participant of participants) {
    const vars = { ...seminarVars, name: participant.name };
    const subject = renderTemplate(template.subject, vars).replace(/[\r\n]/g, " ").replace(/\\n/g, " ").trim();
    const text = renderTemplate(template.body, vars);
    const html = buildHtmlEmail(text);

    try {
      const { data, error } = await resend.emails.send({
        from: `WHGC ゲームチェンジャーズ・フォーラム <${fromEmail}>`,
        to: participant.email,
        subject,
        html,
        text, // プレーンテキスト版も併送（メーラー互換性のため）
      });

      if (error) throw new Error(error.message);

      result.success++;
      result.logs.push({ recipient_email: participant.email, recipient_name: participant.name, status: "sent", resend_id: data?.id });

      await db.prepare(
        `INSERT INTO email_send_logs (schedule_id, seminar_id, recipient_email, recipient_name, status, resend_id, sent_at)
         VALUES (?, ?, ?, ?, 'sent', ?, ?)`
      ).bind(schedule.id, seminarId, participant.email, participant.name, data?.id ?? null, now).run();

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      result.failed++;
      result.logs.push({ recipient_email: participant.email, recipient_name: participant.name, status: "failed", error_message: errorMessage });

      await db.prepare(
        `INSERT INTO email_send_logs (schedule_id, seminar_id, recipient_email, recipient_name, status, error_message, sent_at)
         VALUES (?, ?, ?, ?, 'failed', ?, ?)`
      ).bind(schedule.id, seminarId, participant.email, participant.name, errorMessage, now).run();
    }
  }

  const finalStatus = result.failed === 0 ? "sent" : result.success > 0 ? "sent" : "failed";
  await db.prepare(
    `UPDATE email_schedules SET status = ?, sent_at = ?, updated_at = ? WHERE id = ?`
  ).bind(finalStatus, now, now, schedule.id).run();

  return result;
}
