import { NextRequest, NextResponse } from "next/server";
import { getD1 } from "@/lib/d1";
import { verifyAdminRequest } from "@/lib/auth";
import { randomUUID } from "crypto";

// GET /api/newsletter/lists — 一覧取得
export async function GET(request: NextRequest) {
  const ok = await verifyAdminRequest(request);
  if (!ok) return NextResponse.json({ error: "認証が必要です" }, { status: 401 });

  try {
    const db = await getD1();
    const rows = await db.prepare(
      `SELECT * FROM newsletter_lists ORDER BY created_at DESC`
    ).all() as any;

    const lists = (rows.results ?? []).map((r: any) => ({
      ...r,
      conditions: JSON.parse(r.conditions || "[]"),
    }));

    return NextResponse.json(lists);
  } catch (error) {
    console.error("[newsletter/lists] GET error:", error);
    return NextResponse.json({ error: "取得に失敗しました" }, { status: 500 });
  }
}

// POST /api/newsletter/lists — 新規作成
export async function POST(request: NextRequest) {
  const ok = await verifyAdminRequest(request);
  if (!ok) return NextResponse.json({ error: "認証が必要です" }, { status: 401 });

  try {
    const body = await request.json();
    const { name = "", description = "", conditions = [] } = body;

    const db = await getD1();
    const now = new Date().toISOString();
    const id = randomUUID();

    await db.prepare(
      `INSERT INTO newsletter_lists (id, name, description, conditions, preview_count, created_at, updated_at)
       VALUES (?, ?, ?, ?, 0, ?, ?)`
    ).bind(id, name, description, JSON.stringify(conditions), now, now).run();

    return NextResponse.json({ id, success: true });
  } catch (error) {
    console.error("[newsletter/lists] POST error:", error);
    return NextResponse.json({ error: "保存に失敗しました" }, { status: 500 });
  }
}
