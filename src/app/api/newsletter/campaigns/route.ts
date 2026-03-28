import { NextRequest, NextResponse } from "next/server";
import { getD1 } from "@/lib/d1";
import { verifyAdminRequest } from "@/lib/auth";
import { randomUUID } from "crypto";

export interface NewsletterCampaign {
  id: string;
  subject: string;
  body: string;
  status: "draft" | "sent";
  recipient_tags: string[]; // [] = 全員
  recipient_count: number;
  sent_count: number;
  failed_count: number;
  sent_at: string | null;
  created_at: string;
  updated_at: string;
}

// GET /api/newsletter/campaigns — 一覧取得
export async function GET(request: NextRequest) {
  const ok = await verifyAdminRequest(request);
  if (!ok) return NextResponse.json({ error: "認証が必要です" }, { status: 401 });

  try {
    const db = await getD1();
    const rows = await db.prepare(
      `SELECT * FROM newsletter_campaigns ORDER BY created_at DESC`
    ).all() as any;

    const campaigns = (rows.results ?? []).map((r: any) => ({
      ...r,
      recipient_tags: JSON.parse(r.recipient_tags || "[]"),
    }));

    return NextResponse.json(campaigns);
  } catch (error) {
    console.error("[newsletter/campaigns] GET error:", error);
    return NextResponse.json({ error: "取得に失敗しました" }, { status: 500 });
  }
}

// POST /api/newsletter/campaigns — 新規作成（下書き保存）
export async function POST(request: NextRequest) {
  const ok = await verifyAdminRequest(request);
  if (!ok) return NextResponse.json({ error: "認証が必要です" }, { status: 401 });

  try {
    const body = await request.json();
    const { subject = "", body: emailBody = "", recipient_tags = [] } = body;

    const db = await getD1();
    const now = new Date().toISOString();
    const id = randomUUID();

    await db.prepare(
      `INSERT INTO newsletter_campaigns (id, subject, body, status, recipient_tags, recipient_count, sent_count, failed_count, created_at, updated_at)
       VALUES (?, ?, ?, 'draft', ?, 0, 0, 0, ?, ?)`
    ).bind(id, subject, emailBody, JSON.stringify(recipient_tags), now, now).run();

    return NextResponse.json({ id, success: true });
  } catch (error) {
    console.error("[newsletter/campaigns] POST error:", error);
    return NextResponse.json({ error: "保存に失敗しました" }, { status: 500 });
  }
}
