import { NextRequest, NextResponse } from "next/server";
import { getD1 } from "@/lib/d1";
import type { EmailSchedule, EmailTemplate } from "@/lib/d1";
import { verifyAdminRequest } from "@/lib/auth";
import { renderTemplate, buildSeminarVars } from "@/lib/email/bulk";
import { findMasterRowById, findMasterRowByIdForTenant } from "@/lib/google/sheets";
import { rowToSeminar } from "@/lib/seminars";
import { Resend } from "resend";

// POST /api/email-schedules/[scheduleId]/test-send
// 指定したメールアドレスへテスト送信する（D1ログ・ステータス変更なし）
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ scheduleId: string }> }
) {
  const ok = await verifyAdminRequest(request);
  if (!ok) return NextResponse.json({ error: "認証が必要です" }, { status: 401 });

  try {
    const { scheduleId } = await params;
    const body = await request.json().catch(() => ({}));
    const email: string = body.email ?? "";
    const tenant: string | null = body.tenant ?? null;

    if (!email) {
      return NextResponse.json({ error: "送信先メールアドレスを指定してください" }, { status: 400 });
    }

    const db = await getD1();

    const schedule = await db
      .prepare("SELECT * FROM email_schedules WHERE id = ?")
      .bind(Number(scheduleId))
      .first<EmailSchedule>();

    if (!schedule) {
      return NextResponse.json({ error: "スケジュールが見つかりません" }, { status: 404 });
    }

    const template = await db
      .prepare("SELECT * FROM email_templates WHERE id = ?")
      .bind(schedule.template_id)
      .first<EmailTemplate>();

    if (!template) {
      return NextResponse.json({ error: "テンプレートが見つかりません" }, { status: 404 });
    }

    // セミナー情報取得
    const masterResult = tenant
      ? await findMasterRowByIdForTenant(tenant, schedule.seminar_id)
      : await findMasterRowById(schedule.seminar_id);

    if (!masterResult) {
      return NextResponse.json({ error: "セミナーが見つかりません" }, { status: 404 });
    }

    const seminar = rowToSeminar(masterResult.values);
    const seminarVars = buildSeminarVars(seminar);
    const vars = { ...seminarVars, name: "（テスト）" };

    const subject = `【テスト送信】${renderTemplate(template.subject, vars)}`;
    const text = renderTemplate(template.body, vars);
    const html = `<pre style="font-family:sans-serif;white-space:pre-wrap;line-height:1.7">${text}</pre>`;

    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) throw new Error("RESEND_API_KEY is not set");
    const resend = new Resend(apiKey);

    const fromEmail = process.env.RESEND_FROM_EMAIL ?? "noreply@events.allianceforum.org";

    const { error } = await resend.emails.send({
      from: `WHGC ゲームチェンジャーズ・フォーラム <${fromEmail}>`,
      to: email,
      subject,
      html,
    });

    if (error) throw new Error(error.message);

    return NextResponse.json({ success: true, to: email });
  } catch (error) {
    console.error("[TestSend] POST error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "テスト送信に失敗しました" },
      { status: 500 }
    );
  }
}
