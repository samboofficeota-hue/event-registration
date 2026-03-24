import { NextRequest, NextResponse } from "next/server";
import { getD1 } from "@/lib/d1";
import type { EmailTemplate } from "@/lib/d1";
import { verifyAdminRequest } from "@/lib/auth";

// GET /api/email-templates/[id]
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const db = await getD1();
    const template = await db.prepare(
      "SELECT * FROM email_templates WHERE id = ?"
    ).bind(id).first<EmailTemplate>();

    if (!template) {
      return NextResponse.json({ error: "テンプレートが見つかりません" }, { status: 404 });
    }
    return NextResponse.json(template);
  } catch (error) {
    console.error("[EmailTemplates] GET error:", error);
    return NextResponse.json({ error: "テンプレートの取得に失敗しました" }, { status: 500 });
  }
}

// PUT /api/email-templates/[id] - テンプレート更新（管理者のみ）
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ok = await verifyAdminRequest(request);
  if (!ok) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const body = await request.json();
    const { subject, body: bodyText, name } = body;

    if (!subject || !bodyText) {
      return NextResponse.json({ error: "件名と本文は必須です" }, { status: 400 });
    }

    const db = await getD1();
    const now = new Date().toISOString();

    const existing = await db.prepare(
      "SELECT id FROM email_templates WHERE id = ?"
    ).bind(id).first();

    if (!existing) {
      return NextResponse.json({ error: "テンプレートが見つかりません" }, { status: 404 });
    }

    await db.prepare(
      `UPDATE email_templates
       SET name = ?, subject = ?, body = ?, updated_at = ?
       WHERE id = ?`
    ).bind(name ?? existing.name, subject, bodyText, now, id).run();

    const updated = await db.prepare(
      "SELECT * FROM email_templates WHERE id = ?"
    ).bind(id).first<EmailTemplate>();

    return NextResponse.json(updated);
  } catch (error) {
    console.error("[EmailTemplates] PUT error:", error);
    return NextResponse.json({ error: "テンプレートの更新に失敗しました" }, { status: 500 });
  }
}
