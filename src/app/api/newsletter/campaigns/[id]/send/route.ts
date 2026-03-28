import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { getD1 } from "@/lib/d1";
import { verifyAdminRequest } from "@/lib/auth";
import { buildHtmlEmail } from "@/lib/email/bulk";

const BATCH_SIZE = 100; // Resend batch.send の上限
const FROM_NAME = "WHGC ゲームチェンジャーズ・フォーラム";

// POST /api/newsletter/campaigns/[id]/send
// Body:
//   { test_email }          → テスト送信（1件）
//   { offset?, batch_size? } → バッチ送信（クライアントループ）
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ok = await verifyAdminRequest(request);
  if (!ok) return NextResponse.json({ error: "認証が必要です" }, { status: 401 });

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const testEmail: string | undefined = body.test_email;
  const offset: number = body.offset ?? 0;
  const batchSize: number = Math.min(body.batch_size ?? BATCH_SIZE, BATCH_SIZE);

  try {
    const db = await getD1();

    // キャンペーン取得
    const campaign = await db.prepare(
      `SELECT * FROM newsletter_campaigns WHERE id = ?`
    ).bind(id).first() as any;

    if (!campaign) return NextResponse.json({ error: "キャンペーンが見つかりません" }, { status: 404 });
    if (!campaign.subject || !campaign.body) {
      return NextResponse.json({ error: "件名・本文を入力してください" }, { status: 400 });
    }

    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) return NextResponse.json({ error: "RESEND_API_KEY が設定されていません" }, { status: 500 });
    const resend = new Resend(apiKey);

    const fromEmail = process.env.RESEND_FROM_EMAIL ?? "noreply@events.allianceforum.org";
    const now = new Date().toISOString();

    // ── テスト送信 ──────────────────────────────────────────
    if (testEmail) {
      const html = buildHtmlEmail(campaign.body);
      const { error } = await resend.emails.send({
        from: `${FROM_NAME} <${fromEmail}>`,
        to: testEmail,
        subject: `[テスト] ${campaign.subject}`,
        html,
        text: campaign.body,
      });
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ success: true, mode: "test", to: testEmail });
    }

    // ── 送信対象の購読者を取得（offset/batch_size で絞り込み） ──
    if (campaign.status === "sent" && offset === 0) {
      return NextResponse.json({ error: "このキャンペーンは送信済みです" }, { status: 400 });
    }

    const recipientTags: string[] = JSON.parse(campaign.recipient_tags || "[]");

    // 全体件数（進捗計算用）
    let totalCount = 0;
    let subscribers: { id: string; email: string; name: string }[] = [];

    if (recipientTags.length === 0) {
      const countRow = await db.prepare(
        `SELECT COUNT(*) AS cnt FROM newsletter_subscribers WHERE status = 'active'`
      ).first() as any;
      totalCount = countRow?.cnt ?? 0;

      const rows = await db.prepare(
        `SELECT id, email, name FROM newsletter_subscribers
         WHERE status = 'active'
         ORDER BY created_at ASC
         LIMIT ? OFFSET ?`
      ).bind(batchSize, offset).all() as any;
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
         ORDER BY s.created_at ASC
         LIMIT ? OFFSET ?`
      ).bind(...recipientTags, batchSize, offset).all() as any;
      subscribers = rows.results ?? [];
    }

    if (subscribers.length === 0 && offset === 0) {
      return NextResponse.json({ error: "送信対象の購読者がいません" }, { status: 400 });
    }

    // 最初のバッチで recipient_count を記録
    if (offset === 0) {
      await db.prepare(
        `UPDATE newsletter_campaigns SET recipient_count = ?, updated_at = ? WHERE id = ?`
      ).bind(totalCount, now, id).run();
    }

    // ── Resend batch.send で一括送信 ──────────────────────
    const messages = subscribers.map((subscriber) => {
      const personalizedBody = campaign.body.replace(/\{\{name\}\}/g, subscriber.name || "");
      return {
        from: `${FROM_NAME} <${fromEmail}>`,
        to: subscriber.email,
        subject: campaign.subject as string,
        html: buildHtmlEmail(personalizedBody),
        text: personalizedBody,
      };
    });

    let sentCount = 0;
    let failedCount = 0;

    if (messages.length > 0) {
      const { data: batchData, error } = await resend.batch.send(messages);
      const data = batchData as Array<{ id?: string }> | null;

      if (error) {
        // バッチ全体が失敗
        failedCount = subscribers.length;
        for (const subscriber of subscribers) {
          await db.prepare(
            `INSERT INTO newsletter_send_logs (campaign_id, subscriber_id, email, name, status, error_message, sent_at)
             VALUES (?, ?, ?, ?, 'failed', ?, ?)`
          ).bind(id, subscriber.id, subscriber.email, subscriber.name, error.message, now).run();
        }
      } else {
        // 個別の送信結果を記録
        for (let i = 0; i < subscribers.length; i++) {
          const subscriber = subscribers[i];
          const resendId = data?.[i]?.id ?? null;
          if (resendId) {
            sentCount++;
            await db.prepare(
              `INSERT INTO newsletter_send_logs (campaign_id, subscriber_id, email, name, status, resend_id, sent_at)
               VALUES (?, ?, ?, ?, 'sent', ?, ?)`
            ).bind(id, subscriber.id, subscriber.email, subscriber.name, resendId, now).run();
          } else {
            failedCount++;
            await db.prepare(
              `INSERT INTO newsletter_send_logs (campaign_id, subscriber_id, email, name, status, error_message, sent_at)
               VALUES (?, ?, ?, ?, 'failed', ?, ?)`
            ).bind(id, subscriber.id, subscriber.email, subscriber.name, "No resend_id returned", now).run();
          }
        }
      }
    }

    // 累計送信数を更新
    await db.prepare(
      `UPDATE newsletter_campaigns
       SET sent_count = sent_count + ?,
           failed_count = failed_count + ?,
           updated_at = ?
       WHERE id = ?`
    ).bind(sentCount, failedCount, now, id).run();

    const nextOffset = offset + subscribers.length;
    const hasMore = nextOffset < totalCount;

    // 最終バッチで status を sent に更新
    if (!hasMore) {
      await db.prepare(
        `UPDATE newsletter_campaigns SET status = 'sent', sent_at = ?, updated_at = ? WHERE id = ?`
      ).bind(now, now, id).run();
    }

    return NextResponse.json({
      success: true,
      sent: sentCount,
      failed: failedCount,
      batch_size: subscribers.length,
      offset,
      next_offset: nextOffset,
      total: totalCount,
      has_more: hasMore,
    });

  } catch (error) {
    console.error("[newsletter/campaigns/[id]/send] POST error:", error);
    return NextResponse.json({ error: "送信に失敗しました" }, { status: 500 });
  }
}
