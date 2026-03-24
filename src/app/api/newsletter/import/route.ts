import { NextRequest, NextResponse } from "next/server";
import { getD1 } from "@/lib/d1";
import { verifyAdminRequest } from "@/lib/auth";
import { randomUUID } from "crypto";

// POST /api/newsletter/import — CSV 一括インポート
// Body: { rows: [{email, name, company, department, phone, note, tags}[]], filename, source }
export async function POST(request: NextRequest) {
  const ok = await verifyAdminRequest(request);
  if (!ok) return NextResponse.json({ error: "認証が必要です" }, { status: 401 });

  try {
    const body = await request.json();
    const { rows = [], filename = "", source = "csv_import", tags: globalTags = [] } = body;

    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ error: "データがありません" }, { status: 400 });
    }

    const db = await getD1();
    const now = new Date().toISOString();
    let imported = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const row of rows) {
      const email = (row.email ?? "").toLowerCase().trim();
      if (!email || !email.includes("@")) { skipped++; continue; }

      try {
        const id = randomUUID();
        await db.prepare(
          `INSERT OR IGNORE INTO newsletter_subscribers
           (id, email, name, company, department, phone, note, source, status, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)`
        ).bind(
          id,
          email,
          row.name ?? "",
          row.company ?? "",
          row.department ?? "",
          row.phone ?? "",
          row.note ?? "",
          source,
          now, now
        ).run();

        // 実際に INSERT できたか確認（IGNORE で既存スキップされた場合は changes=0）
        const check = await db.prepare("SELECT id FROM newsletter_subscribers WHERE email = ?").bind(email).first() as { id: string } | null;
        if (!check) { skipped++; continue; }

        const actualId = check.id;
        const isNew = actualId === id; // 今回作ったもの
        if (!isNew) { skipped++; continue; }

        // タグ付与（グローバルタグ + 行ごとのタグ）
        const rowTags = [
          ...globalTags,
          ...(row.tags ? String(row.tags).split(/[,、]/).map((t: string) => t.trim()).filter(Boolean) : []),
        ];
        for (const tag of rowTags) {
          await db.prepare(
            `INSERT OR IGNORE INTO newsletter_tags (subscriber_id, tag, created_at) VALUES (?, ?, ?)`
          ).bind(actualId, tag, now).run();
        }

        imported++;
      } catch {
        errors.push(email);
        skipped++;
      }
    }

    // インポート履歴を記録
    await db.prepare(
      `INSERT INTO newsletter_import_batches (filename, total, imported, skipped, created_at)
       VALUES (?, ?, ?, ?, ?)`
    ).bind(filename, rows.length, imported, skipped, now).run();

    return NextResponse.json({ imported, skipped, total: rows.length, errors });
  } catch (error) {
    console.error("[Newsletter/Import] POST error:", error);
    return NextResponse.json({ error: "インポートに失敗しました" }, { status: 500 });
  }
}
