import { NextRequest, NextResponse } from "next/server";
import { getD1, getSeminarByIdFromD1 } from "@/lib/d1";
import type { EmailSchedule, EmailTemplate } from "@/lib/d1";
import { verifyAdminRequest } from "@/lib/auth";
import { renderTemplate, buildSeminarVars, buildHtmlEmail } from "@/lib/email/bulk";
import { d1SeminarToSeminar } from "@/lib/seminars";
import { Resend } from "resend";

// POST /api/email-schedules/[scheduleId]/test-send
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

    if (!email) {
      return NextResponse.json({ error: "送信先メールアドレスを指定してください" }, { status: 400 });
    }

    const db = await getD1();

    // スケジュール取得
    const schedule = await db
      .prepare("SELECT * FROM email_schedules WHERE id = ?")
      .bind(Number(scheduleId))
      .first() as EmailSchedule | null;

    if (!schedule) {
      return NextResponse.json({ error: "スケジュールが見つかりません" }, { status: 404 });
    }

    // テンプレート取得
    const template = await db
      .prepare("SELECT * FROM email_templates WHERE id = ?")
      .bind(schedule.template_id)
      .first() as EmailTemplate | null;

    if (!template) {
      return NextResponse.json({ error: "テンプレートが見つかりません" }, { status: 404 });
    }

    // セミナー情報取得（D1）
    const seminarRow = await getSeminarByIdFromD1(schedule.seminar_id);
    if (!seminarRow) {
      return NextResponse.json({ error: "セミナーが見つかりません" }, { status: 404 });
    }
    const seminar = d1SeminarToSeminar(seminarRow);
    const seminarVars = buildSeminarVars(seminar);
    const vars = { ...seminarVars, name: "（テスト）" };

    const subject = `【テスト送信】${renderTemplate(template.subject, vars)}`.replace(/\n/g, " ").trim();
    const text = renderTemplate(template.body, vars);
    const html = buildHtmlEmail(text);

    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) throw new Error("RESEND_API_KEY is not set");
    const resend = new Resend(apiKey);

    const fromEmail = process.env.RESEND_FROM_EMAIL ?? "noreply@events.allianceforum.org";

    const { error } = await resend.emails.send({
      from: `WHGC ゲームチェンジャーズ・フォーラム <${fromEmail}>`,
      to: email,
      subject,
      html,
      text,
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
