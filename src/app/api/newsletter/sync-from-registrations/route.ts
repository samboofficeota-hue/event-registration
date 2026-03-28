import { NextRequest, NextResponse } from "next/server";
import { getD1 } from "@/lib/d1";
import { verifyAdminRequest } from "@/lib/auth";
import { randomUUID } from "crypto";

// POST /api/newsletter/sync-from-registrations
// セミナー registrations テーブルからメルマガ購読者マスターへ同期する。
// 処理:
//   1. registrations に存在するが newsletter_subscribers に未登録の email → 新規追加
//   2. 既存購読者で name / company / department が空欄 → registrations の値で補完
//
// Body (任意):
//   { tenant?: string }  → テナントを指定して絞り込み（省略時は全テナント）
export async function POST(request: NextRequest) {
  const ok = await verifyAdminRequest(request);
  if (!ok) return NextResponse.json({ error: "認証が必要です" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const tenant: string | undefined = body.tenant;

  try {
    const db = await getD1();
    const now = new Date().toISOString();

    // ── 1. 新規登録（newsletter_subscribers に存在しない email を追加） ──
    const tenantClause = tenant ? `AND r.tenant = '${tenant.replace(/'/g, "''")}'` : "";

    // registrations にあってマスターにない確定参加者を取得
    const newRows = await db.prepare(
      `SELECT DISTINCT r.email, r.name, r.company, r.department, r.phone, r.tenant
       FROM registrations r
       WHERE r.email != ''
         AND r.status = 'confirmed'
         ${tenantClause}
         AND NOT EXISTS (
           SELECT 1 FROM newsletter_subscribers s WHERE s.email = r.email
         )
       ORDER BY r.created_at ASC`
    ).all() as any;

    const newSubscribers = (newRows.results ?? []) as {
      email: string; name: string; company: string;
      department: string; phone: string; tenant: string;
    }[];

    let inserted = 0;
    for (const r of newSubscribers) {
      const id = randomUUID();
      await db.prepare(
        `INSERT INTO newsletter_subscribers
         (id, email, name, company, department, phone, status, source, note, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, 'active', 'event', '', ?, ?)`
      ).bind(id, r.email, r.name, r.company, r.department, r.phone, now, now).run();
      inserted++;
    }

    // ── 2. 既存購読者の情報補完（空欄フィールドを registrations の値で埋める） ──
    // name が空 or company が空の購読者を対象に、最新の registration から補完
    const updateRows = await db.prepare(
      `SELECT s.id AS sub_id,
              s.name AS sub_name, s.company AS sub_company, s.department AS sub_dept,
              r.name AS reg_name, r.company AS reg_company, r.department AS reg_dept
       FROM newsletter_subscribers s
       JOIN (
         SELECT email,
                MAX(CASE WHEN name != '' THEN name END) AS name,
                MAX(CASE WHEN company != '' THEN company END) AS company,
                MAX(CASE WHEN department != '' THEN department END) AS department
         FROM registrations
         WHERE status = 'confirmed' ${tenant ? `AND tenant = '${tenant.replace(/'/g, "''")}'` : ""}
         GROUP BY email
       ) r ON r.email = s.email
       WHERE (s.name = '' AND r.name IS NOT NULL)
          OR (s.company = '' AND r.company IS NOT NULL)
          OR (s.department = '' AND r.department IS NOT NULL)
       LIMIT 500`
    ).all() as any;

    let updated = 0;
    for (const row of (updateRows.results ?? []) as any[]) {
      const newName    = row.sub_name    || row.reg_name    || "";
      const newCompany = row.sub_company || row.reg_company || "";
      const newDept    = row.sub_dept    || row.reg_dept    || "";

      await db.prepare(
        `UPDATE newsletter_subscribers
         SET name = ?, company = ?, department = ?, updated_at = ?
         WHERE id = ?`
      ).bind(newName, newCompany, newDept, now, row.sub_id).run();
      updated++;
    }

    return NextResponse.json({
      success: true,
      inserted,   // 新規追加件数
      updated,    // 情報補完件数
      message: `新規追加: ${inserted}件 / 情報補完: ${updated}件`,
    });
  } catch (error) {
    console.error("[newsletter/sync-from-registrations] error:", error);
    return NextResponse.json({ error: "同期に失敗しました" }, { status: 500 });
  }
}
