import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { getD1 } from "@/lib/d1";
import { verifyAdminRequest } from "@/lib/auth";
import { buildHtmlEmail } from "@/lib/email/bulk";

const BATCH_SIZE = 100;
const FROM_NAME  = "WHGC ゲームチェンジャーズ・フォーラム";

// POST /api/newsletter/campaigns/process-scheduled
// スケジュール済みキャンペーンのうち、送信時刻を過ぎたものを 1 バッチ分送信する。
// GitHub Actions から繰り返し呼び出すことで全件送信を完了させる。
// Body: { campaign_id?, offset? }
export async function POST(request: NextRequest) {
  const ok = await verifyAdminRequest(request);
  if (!ok) return NextResponse.json({ error: "認証が必要です" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const targetCampaignId: string | undefined = body.campaign_id;
  const offset: number = body.offset ?? 0;

  const db = await getD1();
  const now = new Date().toISOString();

  // 送信対象キャンペーンを取得
  let campaign: any;
  if (targetCampaignId) {
    campaign = await db.prepare(
      `SELECT * FROM newsletter_campaigns WHERE id = ? AND status = 'scheduled' AND scheduled_at <= ?`
    ).bind(targetCampaignId, now).first();
  } else {
    // 指定なし: 最古の送信期限超過キャンペーンを1件取得
    campaign = await db.prepare(
      `SELECT * FROM newsletter_campaigns
       WHERE status = 'scheduled' AND scheduled_at <= ?
       ORDER BY scheduled_at ASC LIMIT 1`
    ).bind(now).first();
  }

  if (!campaign) {
    return NextResponse.json({ message: "送信対象のキャンペーンはありません", processed: 0 });
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "RESEND_API_KEY が未設定" }, { status: 500 });
  const resend = new Resend(apiKey);
  const fromEmail = process.env.RESEND_FROM_EMAIL ?? "noreply@events.allianceforum.org";

  const recipientTags: string[] = JSON.parse(campaign.recipient_tags || "[]");

  // 送信対象取得
  let totalCount = 0;
  let subscribers: { id: string; email: string; name: string }[] = [];

  if (recipientTags.length === 0) {
    const countRow = await db.prepare(
      `SELECT COUNT(*) AS cnt FROM newsletter_subscribers WHERE status = 'active'`
    ).first() as any;
    totalCount = countRow?.cnt ?? 0;

    const rows = await db.prepare(
      `SELECT id, email, name FROM newsletter_subscribers
       WHERE status = 'active' ORDER BY created_at ASC LIMIT ? OFFSET ?`
    ).bind(BATCH_SIZE, offset).all() as any;
    subscribers = rows.results ?? [];
  } else {
    const placeholders = recipientTags.map(() => "?").join(", ");
    const countRow = await db.prepare(
      `SELECT COUNT(DISTINCT s.id) AS cnt
       FROM newsletter_subscribers s
       JOIN newsletter_tags t ON s.id = t.subscriber_id
       WHERE s.status = 'active' AND t.tag IN (${placeholders})`
    ).bind(...recipientTags).first() as any;
    totalCount = countRow?.cnt ?? 0;

    const rows = await db.prepare(
      `SELECT DISTINCT s.id, s.email, s.name
       FROM newsletter_subscribers s
       JOIN newsletter_tags t ON s.id = t.subscriber_id
       WHERE s.status = 'active' AND t.tag IN (${placeholders})
       ORDER BY s.created_at ASC LIMIT ? OFFSET ?`
    ).bind(...recipientTags, BATCH_SIZE, offset).all() as any;
    subscribers = rows.results ?? [];
  }

  // 初回バッチで recipient_count を記録 & status を sending に変更
  if (offset === 0) {
    await db.prepare(
      `UPDATE newsletter_campaigns SET status = 'sending', recipient_count = ?, updated_at = ? WHERE id = ?`
    ).bind(totalCount, now, campaign.id).run();
  }

  let sentCount = 0;
  let failedCount = 0;

  if (subscribers.length > 0) {
    const messages = subscribers.map((s) => ({
      from: `${FROM_NAME} <${fromEmail}>`,
      to: s.email,
      subject: campaign.subject as string,
      html: buildHtmlEmail((campaign.body as string).replace(/\{\{name\}\}/g, s.name || "")),
      text: (campaign.body as string).replace(/\{\{name\}\}/g, s.name || ""),
    }));

    const { data: batchData, error } = await resend.batch.send(messages);
    const data = batchData as Array<{ id?: string }> | null;

    if (error) {
      failedCount = subscribers.length;
      for (const s of subscribers) {
        await db.prepare(
          `INSERT INTO newsletter_send_logs (campaign_id, subscriber_id, email, name, status, error_message, sent_at)
           VALUES (?, ?, ?, ?, 'failed', ?, ?)`
        ).bind(campaign.id, s.id, s.email, s.name, error.message, now).run();
      }
    } else {
      for (let i = 0; i < subscribers.length; i++) {
        const s = subscribers[i];
        const resendId = data?.[i]?.id ?? null;
        if (resendId) {
          sentCount++;
          await db.prepare(
            `INSERT INTO newsletter_send_logs (campaign_id, subscriber_id, email, name, status, resend_id, sent_at)
             VALUES (?, ?, ?, ?, 'sent', ?, ?)`
          ).bind(campaign.id, s.id, s.email, s.name, resendId, now).run();
        } else {
          failedCount++;
          await db.prepare(
            `INSERT INTO newsletter_send_logs (campaign_id, subscriber_id, email, name, status, error_message, sent_at)
             VALUES (?, ?, ?, ?, 'failed', ?, ?)`
          ).bind(campaign.id, s.id, s.email, s.name, "No resend_id returned", now).run();
        }
      }
    }
  }

  await db.prepare(
    `UPDATE newsletter_campaigns SET sent_count = sent_count + ?, failed_count = failed_count + ?, updated_at = ? WHERE id = ?`
  ).bind(sentCount, failedCount, now, campaign.id).run();

  const nextOffset = offset + subscribers.length;
  const hasMore = nextOffset < totalCount;

  if (!hasMore) {
    await db.prepare(
      `UPDATE newsletter_campaigns SET status = 'sent', sent_at = ?, updated_at = ? WHERE id = ?`
    ).bind(now, now, campaign.id).run();
  }

  return NextResponse.json({
    campaign_id: campaign.id,
    subject: campaign.subject,
    sent: sentCount,
    failed: failedCount,
    offset,
    next_offset: nextOffset,
    total: totalCount,
    has_more: hasMore,
  });
}
