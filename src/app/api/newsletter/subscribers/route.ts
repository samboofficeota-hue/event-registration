import { NextRequest, NextResponse } from "next/server";
import { getD1 } from "@/lib/d1";
import { verifyAdminRequest } from "@/lib/auth";
import { randomUUID } from "crypto";

// GET /api/newsletter/subscribers?q=&status=&tag=&page=&limit=
export async function GET(request: NextRequest) {
  const ok = await verifyAdminRequest(request);
  if (!ok) return NextResponse.json({ error: "認証が必要です" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q") ?? "";
  const status = searchParams.get("status") ?? "";
  const tag = searchParams.get("tag") ?? "";
  const page = Math.max(1, Number(searchParams.get("page") ?? "1"));
  const limit = Math.min(200, Number(searchParams.get("limit") ?? "50"));
  const offset = (page - 1) * limit;

  try {
    const db = await getD1();

    let where = "1=1";
    const binds: (string | number)[] = [];

    if (q) {
      where += " AND (s.email LIKE ? OR s.name LIKE ? OR s.company LIKE ?)";
      binds.push(`%${q}%`, `%${q}%`, `%${q}%`);
    }
    if (status) { where += " AND s.status = ?"; binds.push(status); }
    if (tag) {
      where += " AND EXISTS (SELECT 1 FROM newsletter_tags t WHERE t.subscriber_id = s.id AND t.tag = ?)";
      binds.push(tag);
    }

    const countRow = await db
      .prepare(`SELECT COUNT(*) as total FROM newsletter_subscribers s WHERE ${where}`)
      .bind(...binds)
      .first() as { total: number };

    const rows = await db
      .prepare(
        `SELECT s.*,
          (SELECT GROUP_CONCAT(t.tag, ',') FROM newsletter_tags t WHERE t.subscriber_id = s.id) as tags
         FROM newsletter_subscribers s
         WHERE ${where}
         ORDER BY s.created_at DESC
         LIMIT ? OFFSET ?`
      )
      .bind(...binds, limit, offset)
      .all();

    const subscribers = (rows.results as Record<string, unknown>[]).map((r) => ({
      ...r,
      tags: r.tags ? String(r.tags).split(",").filter(Boolean) : [],
    }));

    return NextResponse.json({
      subscribers,
      total: countRow?.total ?? 0,
      page,
      limit,
    });
  } catch (error) {
    console.error("[Newsletter/Subscribers] GET error:", error);
    return NextResponse.json({ error: "取得に失敗しました" }, { status: 500 });
  }
}

// POST /api/newsletter/subscribers — 1件追加
export async function POST(request: NextRequest) {
  const ok = await verifyAdminRequest(request);
  if (!ok) return NextResponse.json({ error: "認証が必要です" }, { status: 401 });

  try {
    const body = await request.json();
    const { email, name = "", company = "", department = "", phone = "", note = "", source = "manual", tags = [] } = body;

    if (!email) return NextResponse.json({ error: "メールアドレスは必須です" }, { status: 400 });

    const db = await getD1();
    const now = new Date().toISOString();
    const id = randomUUID();

    await db.prepare(
      `INSERT INTO newsletter_subscribers (id, email, name, company, department, phone, note, source, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)`
    ).bind(id, email.toLowerCase().trim(), name, company, department, phone, note, source, now, now).run();

    // タグの追加
    for (const tag of tags as string[]) {
      if (tag.trim()) {
        await db.prepare(
          `INSERT OR IGNORE INTO newsletter_tags (subscriber_id, tag, created_at) VALUES (?, ?, ?)`
        ).bind(id, tag.trim(), now).run();
      }
    }

    const created = await db.prepare("SELECT * FROM newsletter_subscribers WHERE id = ?").bind(id).first();
    return NextResponse.json(created, { status: 201 });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    if (msg.includes("UNIQUE")) return NextResponse.json({ error: "このメールアドレスは既に登録されています" }, { status: 409 });
    console.error("[Newsletter/Subscribers] POST error:", error);
    return NextResponse.json({ error: "追加に失敗しました" }, { status: 500 });
  }
}
