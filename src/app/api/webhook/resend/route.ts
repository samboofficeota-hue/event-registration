import { NextRequest, NextResponse } from "next/server";
import { Webhook } from "svix";
import { getD1 } from "@/lib/d1";

// POST /api/webhook/resend
// Resend から送られてくる Webhook イベントを受け取り、D1 に記録する
export async function POST(request: NextRequest) {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (!secret) {
    console.error("[webhook/resend] RESEND_WEBHOOK_SECRET が未設定");
    return NextResponse.json({ error: "設定エラー" }, { status: 500 });
  }

  // 生 body と svix ヘッダーで署名検証
  const rawBody = await request.text();
  const svixId        = request.headers.get("svix-id") ?? "";
  const svixTimestamp = request.headers.get("svix-timestamp") ?? "";
  const svixSignature = request.headers.get("svix-signature") ?? "";

  let payload: Record<string, unknown>;
  try {
    const wh = new Webhook(secret);
    payload = wh.verify(rawBody, {
      "svix-id":        svixId,
      "svix-timestamp": svixTimestamp,
      "svix-signature": svixSignature,
    }) as Record<string, unknown>;
  } catch (err) {
    console.error("[webhook/resend] 署名検証失敗:", err);
    return NextResponse.json({ error: "署名が無効です" }, { status: 400 });
  }

  const eventType = payload.type as string;
  const data = payload.data as Record<string, any>;
  const resendMsgId = (data.email_id ?? data.id ?? "") as string;
  const email       = (data.to ?? "") as string;
  const occurredAt  = (data.created_at ?? new Date().toISOString()) as string;
  const clickUrl    = (data.click?.link ?? "") as string;

  // resend_msg_id から campaign_id / subscriber_id を逆引き
  let campaignId: string | null = null;
  let subscriberId: string | null = null;

  try {
    const db = await getD1();

    const logRow = await db.prepare(
      `SELECT campaign_id, subscriber_id FROM newsletter_send_logs WHERE resend_id = ? LIMIT 1`
    ).bind(resendMsgId).first() as any;

    if (logRow) {
      campaignId   = logRow.campaign_id ?? null;
      subscriberId = logRow.subscriber_id ?? null;
    }

    // エンゲージメントログに記録
    const supportedTypes = ["email.delivered", "email.opened", "email.clicked", "email.bounced", "email.complained"];
    if (supportedTypes.includes(eventType)) {
      const shortType = eventType.replace("email.", ""); // "delivered", "opened", ...
      await db.prepare(
        `INSERT INTO newsletter_engagement_logs
           (resend_msg_id, campaign_id, subscriber_id, email, event_type, url, occurred_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).bind(resendMsgId, campaignId, subscriberId, email, shortType, clickUrl || null, occurredAt).run();

      // バウンス・苦情 → 購読者ステータスを更新
      if (subscriberId && (shortType === "bounced" || shortType === "complained")) {
        const newStatus = shortType === "bounced" ? "bounced" : "unsubscribed";
        await db.prepare(
          `UPDATE newsletter_subscribers SET status = ?, updated_at = ? WHERE id = ?`
        ).bind(newStatus, new Date().toISOString(), subscriberId).run();
      }
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error("[webhook/resend] DB エラー:", err);
    return NextResponse.json({ error: "内部エラー" }, { status: 500 });
  }
}
